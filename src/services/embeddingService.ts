import prisma from '../config/db.js';
import redis from '../config/redisClient.js';
import { normalizeSkillName } from '../utils/skillTaxonomy.js';

const EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';
const CIRCUIT_BREAKER_KEY = 'embeddings:circuit:open';
const CIRCUIT_BREAKER_TTL = 300; // 5 minutes

/**
 * Check if the embedding circuit breaker is open (HF API is failing).
 * Auto-recovers after 5 minutes.
 */
async function isCircuitOpen(): Promise<boolean> {
    const status = await redis.get(CIRCUIT_BREAKER_KEY);
    return status === 'true';
}

async function openCircuit(): Promise<void> {
    await redis.set(CIRCUIT_BREAKER_KEY, 'true', { ex: CIRCUIT_BREAKER_TTL });
    console.warn('[Embedding] Circuit breaker OPEN — HF API disabled for 5 minutes');
}

/**
 * Fetch embeddings from Hugging Face for a batch of texts.
 * Returns null for each text if the API is unavailable.
 */
async function fetchEmbeddingsFromHF(texts: string[]): Promise<(number[] | null)[]> {
    const apiKey = process.env.HF_API_KEY;
    if (!apiKey) {
        console.warn('[Embedding] HF_API_KEY not set — skipping embedding generation');
        return texts.map(() => null);
    }

    if (await isCircuitOpen()) {
        return texts.map(() => null);
    }

    try {
        const response = await fetch(
            `https://api-inference.huggingface.co/models/${EMBEDDING_MODEL}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ inputs: texts }),
            }
        );

        if (!response.ok) {
            console.error(`[Embedding] HF API error: ${response.status}`);
            if (response.status === 404 || response.status === 503) {
                await openCircuit();
            }
            return texts.map(() => null);
        }

        const data = await response.json() as number[][];
        if (!Array.isArray(data) || data.length !== texts.length) {
            console.error('[Embedding] Invalid HF response shape');
            return texts.map(() => null);
        }

        return data;
    } catch (err) {
        console.error('[Embedding] HF API call failed:', err);
        await openCircuit();
        return texts.map(() => null);
    }
}

/**
 * Ensure a skill has an embedding stored in the database.
 * If not, generates one via HF and stores it.
 * This is called when new skills are added (profile updates), NOT on every match.
 */
export async function ensureSkillEmbedding(skill: string): Promise<void> {
    const normalized = normalizeSkillName(skill);

    // Check if embedding already exists
    const existing = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "SkillEmbedding" WHERE "normalizedSkill" = ${normalized} LIMIT 1
    `;
    if (existing.length > 0) return;

    // Generate embedding
    const [embedding] = await fetchEmbeddingsFromHF([normalized]);
    if (!embedding) return;

    // Store in database with pgvector
    const vectorString = `[${embedding.join(',')}]`;
    await prisma.$executeRaw`
        INSERT INTO "SkillEmbedding" ("id", "skill", "normalizedSkill", "embedding", "updatedAt")
        VALUES (gen_random_uuid(), ${skill}, ${normalized}, ${vectorString}::vector, NOW())
        ON CONFLICT ("normalizedSkill") DO UPDATE SET
            "embedding" = ${vectorString}::vector,
            "updatedAt" = NOW()
    `;
    console.log(`[Embedding] Stored embedding for "${normalized}"`);
}

/**
 * Batch-ensure embeddings for multiple skills.
 * Only fetches embeddings for skills not already in the database.
 */
export async function ensureSkillEmbeddings(skills: string[]): Promise<void> {
    const normalized = [...new Set(skills.map(normalizeSkillName))];

    // Find which skills already have embeddings
    const existing = await prisma.$queryRaw<{ normalizedSkill: string }[]>`
        SELECT "normalizedSkill" FROM "SkillEmbedding" 
        WHERE "normalizedSkill" = ANY(${normalized})
    `;
    const existingSet = new Set(existing.map(e => e.normalizedSkill));
    const missing = normalized.filter(s => !existingSet.has(s));

    if (missing.length === 0) return;

    // Fetch embeddings in batches of 50
    const batchSize = 50;
    for (let i = 0; i < missing.length; i += batchSize) {
        const batch = missing.slice(i, i + batchSize);
        const embeddings = await fetchEmbeddingsFromHF(batch);

        // Store each embedding
        const inserts = batch
            .map((skill, idx) => ({ skill, embedding: embeddings[idx] }))
            .filter((item): item is { skill: string; embedding: number[] } => item.embedding !== null);

        for (const { skill, embedding } of inserts) {
            const vectorString = `[${embedding.join(',')}]`;
            await prisma.$executeRaw`
                INSERT INTO "SkillEmbedding" ("id", "skill", "normalizedSkill", "embedding", "updatedAt")
                VALUES (gen_random_uuid(), ${skill}, ${skill}, ${vectorString}::vector, NOW())
                ON CONFLICT ("normalizedSkill") DO UPDATE SET
                    "embedding" = ${vectorString}::vector,
                    "updatedAt" = NOW()
            `;
        }

        if (inserts.length > 0) {
            console.log(`[Embedding] Stored ${inserts.length} embeddings (batch ${Math.floor(i / batchSize) + 1})`);
        }
    }
}

/**
 * Find skills semantically similar to a given skill using pgvector cosine distance.
 * Returns skills with distance < threshold, sorted by similarity.
 */
export async function findSimilarSkills(
    skill: string,
    threshold = 0.3,
    limit = 10
): Promise<{ normalizedSkill: string; distance: number }[]> {
    const normalized = normalizeSkillName(skill);

    // Get the embedding for this skill
    const skillEmb = await prisma.$queryRaw<{ embedding: string }[]>`
        SELECT "embedding"::text FROM "SkillEmbedding" WHERE "normalizedSkill" = ${normalized} LIMIT 1
    `;
    if (skillEmb.length === 0) return [];

    // Find similar skills using pgvector cosine distance
    const results = await prisma.$queryRaw<{ normalizedSkill: string; distance: number }[]>`
        SELECT "normalizedSkill", "embedding" <=> ${skillEmb[0].embedding}::vector AS distance
        FROM "SkillEmbedding"
        WHERE "normalizedSkill" != ${normalized}
        AND "embedding" <=> ${skillEmb[0].embedding}::vector < ${threshold}
        ORDER BY distance
        LIMIT ${limit}
    `;

    return results;
}

/**
 * Find skills matching a fuzzy text query using pg_trgm.
 * Handles typos like "javascrip" → "javascript".
 */
export async function fuzzySearchSkills(
    query: string,
    threshold = 0.3,
    limit = 5
): Promise<{ normalizedSkill: string; similarity: number }[]> {
    const cleaned = query.toLowerCase().trim();

    const results = await prisma.$queryRaw<{ normalizedSkill: string; similarity: number }[]>`
        SELECT "normalizedSkill", similarity("normalizedSkill", ${cleaned}) AS similarity
        FROM "SkillEmbedding"
        WHERE similarity("normalizedSkill", ${cleaned}) > ${threshold}
        ORDER BY similarity DESC
        LIMIT ${limit}
    `;

    return results;
}
