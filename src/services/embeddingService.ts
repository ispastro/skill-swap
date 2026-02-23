import prisma from '../config/db.js';
import { normalizeSkillName } from '../utils/skillTaxonomy.js';

const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || 'cohere'; // 'cohere' or 'huggingface'

/**
 * Fetch embeddings from Cohere (FREE: 1000 calls/month)
 * Using REST API (no SDK needed)
 */
async function fetchEmbeddingsFromCohere(texts: string[]): Promise<(number[] | null)[]> {
    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) {
        console.warn('[Embedding] COHERE_API_KEY not set');
        return texts.map(() => null);
    }

    try {
        const response = await fetch('https://api.cohere.com/v1/embed', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'embed-english-light-v3.0',
                texts,
                input_type: 'search_document',
                truncate: 'END'
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`[Embedding] Cohere error: ${response.status} - ${error}`);
            return texts.map(() => null);
        }

        const data = await response.json() as { embeddings: number[][] };
        return data.embeddings;
    } catch (err) {
        console.error('[Embedding] Cohere failed:', err);
        return texts.map(() => null);
    }
}

/**
 * Fetch embeddings from HuggingFace (fallback)
 */
async function fetchEmbeddingsFromHF(texts: string[]): Promise<(number[] | null)[]> {
    const apiKey = process.env.HF_API_KEY;
    if (!apiKey) return texts.map(() => null);

    try {
        const response = await fetch(
            'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ inputs: texts }),
            }
        );

        if (!response.ok) return texts.map(() => null);
        const data = await response.json() as number[][];
        return data;
    } catch {
        return texts.map(() => null);
    }
}

/**
 * Smart embedding fetcher with fallback
 */
async function fetchEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
    // Try primary provider
    const primary = EMBEDDING_PROVIDER === 'cohere' 
        ? await fetchEmbeddingsFromCohere(texts)
        : await fetchEmbeddingsFromHF(texts);
    
    if (primary.some(e => e !== null)) return primary;

    // Fallback to alternative
    console.warn('[Embedding] Primary failed, trying fallback');
    return EMBEDDING_PROVIDER === 'cohere'
        ? await fetchEmbeddingsFromHF(texts)
        : await fetchEmbeddingsFromCohere(texts);
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
    const [embedding] = await fetchEmbeddings([normalized]);
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
        const embeddings = await fetchEmbeddings(batch);

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
