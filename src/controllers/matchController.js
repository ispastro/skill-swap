import prisma from '../config/db.js';
import { suggestSkills } from '../utils/suggestSkills.js';
import Fuse from 'fuse.js';
import fetch from 'node-fetch';
import redis from '../config/redisClient.js';

// --- Safe JSON helper ---
function safeParseMaybeJSON(str) {
  if (typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed) return null;
  const first = trimmed[0];
  if (first !== '{' && first !== '[') return null; // fast reject for '[object Object]' etc
  try { return JSON.parse(trimmed); } catch { return null; }
}

// --- Embedding-based Skill Normalization ---
let embeddingsDisabled = false; // runtime flag to short-circuit embedding calls after hard failure

async function batchFetchEmbeddings(skills) {
  if (embeddingsDisabled) return skills.map(() => null);
  const cleanedSkills = skills.map(skill => skill.toLowerCase().trim().replace(/[^a-z0-9+\-# ]/gi, ''));
  const uniqueCleaned = [...new Set(cleanedSkills)]; // Dedupe
  const cacheKeys = uniqueCleaned.map(s => `embedding:${s}`);
  const cachedEmbeddings = await redis.mget(cacheKeys);

  const toFetch = [];
  const embeddingsMap = {};
  uniqueCleaned.forEach((s, i) => {
    if (cachedEmbeddings[cacheKeys[i]]) {
      try {
        embeddingsMap[s] = JSON.parse(cachedEmbeddings[cacheKeys[i]]);
      } catch (e) {
        console.warn(`[Match] Invalid embedding cache for ${s}`);
      }
    } else {
      toFetch.push(s);
    }
  });

  if (toFetch.length > 0) {
    // Batch into groups of 50 to avoid HF limits
    const batchSize = 50;
    for (let i = 0; i < toFetch.length; i += batchSize) {
      const batch = toFetch.slice(i, i + batchSize);
      try {
        const start = Date.now();
        // Prefer model endpoint (pipeline endpoint sometimes 404s depending on account / region)
        const response = await fetch('https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.HF_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: batch })
        });
        if (!response.ok) {
          if (response.status === 404) {
            console.error('[Match] Embedding model endpoint returned 404. Disabling embeddings for this run.');
            embeddingsDisabled = true;
            return cleanedSkills.map(() => null);
          }
            throw new Error(`Status ${response.status}`);
        }
        const data = await response.json();
        if (!Array.isArray(data) || data.length !== batch.length) throw new Error('Invalid batch response');

        const setData = {};
        batch.forEach((s, j) => {
          if (Array.isArray(data[j])) {
            embeddingsMap[s] = data[j];
            setData[`embedding:${s}`] = JSON.stringify(data[j]);
          }
        });
        // Store each embedding with TTL (avoid incorrect expire usage on array of keys)
        for (const [k, v] of Object.entries(setData)) {
          await redis.set(k, v, { EX: 86400 });
        }
        console.log(`[Match] Batched ${batch.length} embeddings (${Date.now() - start}ms)`);
      } catch (err) {
        console.error(`[Match] Batch embedding error:`, err);
      }
    }
  }

  return cleanedSkills.map(s => embeddingsMap[s] || null);
}

// Cosine similarity (unchanged)
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

// --- Dynamic Synonym Generation with Optimized Clustering ---
async function generateDynamicSynonyms() {
  const cacheKey = 'dynamicSynonyms';
  const cached = await redis.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      await redis.del(cacheKey);
    }
  }

  // Fetch unique skills (limit to top 1000 frequent if too many, but assume reasonable)
  const skillsQuery = await prisma.$queryRaw`
    SELECT unnest("skillsHave") AS skill FROM "User"
    UNION
    SELECT unnest("skillsWant") AS skill FROM "User"
  `;
  const skills = [...new Set(skillsQuery.map(row => row.skill))].slice(0, 1000); // Cap for perf

  const embeddings = await batchFetchEmbeddings(skills);

  // Use Fuse for fuzzy grouping instead of O(n²) pairwise
  const fuse = new Fuse(skills, { threshold: 0.3, includeScore: true });
  const synonymMap = {};
  skills.forEach((skill, i) => {
    if (!embeddings[i]) return;
    const results = fuse.search(skill).filter(r => r.score < 0.3 && r.item !== skill);
    results.forEach(r => {
      const sim = cosineSimilarity(embeddings[i], embeddings[skills.indexOf(r.item)]);
      if (sim > 0.7) {
        const primary = skill.length < r.item.length ? r.item : skill;
        synonymMap[skill] = primary;
        synonymMap[r.item] = primary;
      }
    });
  });

  await redis.set(cacheKey, JSON.stringify(synonymMap), { EX: 86400 });
  console.log('[Match] Optimized synonym map generated');
  return synonymMap;
}

// --- HF Skill Verification with Caching ---
async function verifySkillWithHF(skill, bio) {
  if (!bio || typeof bio !== 'string' || bio.trim().length === 0) {
    return { verified: false, confidence: 0.0 };
  }
  const safeBio = bio.length > 500 ? bio.slice(0, 500) : bio; // limit payload size
  const cacheKey = `verification:${skill}:${safeBio.slice(0, 50)}`; // partial hash
  const cached = await redis.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch { await redis.del(cacheKey); }
  }
  try {
    const response = await fetch('https://api-inference.huggingface.co/models/facebook/bart-large-mnli', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.HF_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: safeBio, parameters: { candidate_labels: [skill] }, options: { wait_for_model: true } })
    });
    if (!response.ok) {
      if (response.status === 404) {
        console.warn('[Match] Verification model 404. Returning neutral confidence.');
        return { verified: false, confidence: 0.0 };
      }
      console.warn(`[Match] Verification model HTTP ${response.status}`);
      return { verified: false, confidence: 0.0 };
    }
    const data = await response.json();
    const score = Array.isArray(data.scores) && data.scores.length > 0 ? data.scores[0] : 0.0;
    const result = { verified: score > 0.7, confidence: score };
    await redis.set(cacheKey, JSON.stringify(result), { EX: 86400 });
    return result;
  } catch (err) {
    console.error('[Match] HF verification error:', err);
    return { verified: false, confidence: 0.0 };
  }
}

function extractYearsOfExperience(bio) {
  if (!bio || typeof bio !== 'string') return 0;
  const match = bio.match(/(\d+)\s*(?:years?|yrs?)/i);
  return match ? parseInt(match[1], 10) : 0;
}

export async function normalizeSkills(skills) {
  if (!skills || !Array.isArray(skills)) return [];
  const synonymMap = await generateDynamicSynonyms();
  return skills.map(skill => {
    const cleaned = skill.toLowerCase().trim().replace(/[^a-z0-9+\-# ]/gi, '');
    return synonymMap[cleaned] || cleaned;
  });
}

export function fuzzyMatch(skillsA, skillsB) {
  if (!skillsA.length || !skillsB.length) return [];
  const fuse = new Fuse(skillsB, { threshold: 0.4 });
  return skillsA.reduce((acc, skill) => {
    const result = fuse.search(skill);
    if (result.length > 0) acc.push(result[0].item);
    return acc;
  }, []);
}

export async function semanticMatch(skillsA, skillsB) {
  if (embeddingsDisabled) return 0; // short-circuit if embeddings unavailable
  if (!skillsA.length || !skillsB.length) return 0;
  const allSkills = [...new Set([...skillsA, ...skillsB])];
  const embeddings = await batchFetchEmbeddings(allSkills);
  if (embeddingsDisabled) return 0; // could have been flipped during fetch
  const embMap = {};
  allSkills.forEach((s, i) => embMap[s] = embeddings[i]);

  let totalSimilarity = 0;
  let validComparisons = 0;
  const threshold = 0.7;
  for (const a of skillsA) {
    const embA = embMap[a];
    if (!embA) continue;
    for (const b of skillsB) {
      const embB = embMap[b];
      if (!embB) continue;
      const sim = cosineSimilarity(embA, embB);
      if (sim > threshold) {
        totalSimilarity += sim;
        validComparisons++;
      }
    }
  }
  return validComparisons > 0 ? totalSimilarity / validComparisons : 0;
}

export async function calculateWeightedMatchScore(userA, userB) {
  // Assume normalized skills are pre-stored in DB
  const skillsTheyHave = userB.normalizedSkillsHave || await normalizeSkills(userB.skillsHave);
  const skillsTheyWant = userB.normalizedSkillsWant || await normalizeSkills(userB.skillsWant);
  const skillsIHave = userA.normalizedSkillsHave || await normalizeSkills(userA.skillsHave);
  const skillsIWant = userA.normalizedSkillsWant || await normalizeSkills(userA.skillsWant);

  const matchedHave = fuzzyMatch(skillsIWant, skillsTheyHave);
  const matchedWant = fuzzyMatch(skillsIHave, skillsTheyWant);

  const totalPossible = new Set([...skillsTheyHave, ...skillsTheyWant, ...skillsIHave, ...skillsIWant]).size;
  const fuzzyMatched = matchedHave.length + matchedWant.length;
  const fuzzyScore = totalPossible > 0 ? fuzzyMatched / totalPossible : 0;

  // Skip semantic if fuzzy low
  let semanticScore = 0;
  if (fuzzyScore > 0.3) {
    const semanticScoreHave = await semanticMatch(skillsIWant, skillsTheyHave);
    const semanticScoreWant = await semanticMatch(skillsIHave, skillsTheyWant);
    semanticScore = (semanticScoreHave + semanticScoreWant) / 2;
  }

  const yearsA = extractYearsOfExperience(userA.bio);
  const yearsB = extractYearsOfExperience(userB.bio);
  const expBoost = Math.min((yearsA + yearsB) / 20, 0.1);

  let verificationBoost = 0;
  const matchedSkills = [...matchedHave, ...matchedWant];
  if (matchedSkills.length > 0 && fuzzyScore > 0.5) { // Limit to high-potential and skip if no bio
    const verifications = await Promise.all(matchedSkills.map(skill => verifySkillWithHF(skill, userB.bio)));
    const avgConfidence = verifications.reduce((sum, v) => sum + v.confidence, 0) / verifications.length;
    verificationBoost = Math.min(avgConfidence * 0.2, 0.2);
  }

  let hybridScore = 0.6 * fuzzyScore + 0.25 * semanticScore + 0.1 * expBoost + 0.05 * verificationBoost;
  hybridScore = Math.min(hybridScore, 1);
  const matchScore = Math.round(hybridScore * 100);

  return { matchScore, matchedHave, matchedWant, verificationConfidence: verificationBoost * 100 };
}

export function getConfidenceLabel(score) {
  if (score >= 80) return '🔥 Strong Match';
  if (score >= 40) return '👌 Medium Match';
  return '🙂 Light Match';
}

export const findSkillsMatches = async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!currentUser) return res.status(404).json({ message: "User not found" });

    const cacheKey = `matches:${currentUser.id}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = safeParseMaybeJSON(cached);
      if (parsed && parsed.matches) {
        console.log(`[Match] Cache hit for user ${currentUser.id}`);
        return res.status(200).json(parsed);
      } else if (cached === '[object Object]') {
        console.warn(`[Match] Corrupted top-level cache value (object string) for ${cacheKey}, deleting`);
        await redis.del(cacheKey);
      } else if (!parsed) {
        await redis.del(cacheKey);
      }
    }

    // Filter candidates by overlapping skills first (using Prisma full-text or array overlap)
    const candidates = await prisma.user.findMany({
      where: {
        id: { not: currentUser.id },
        OR: [
          { skillsHave: { hasSome: currentUser.skillsWant } },
          { skillsWant: { hasSome: currentUser.skillsHave } },
        ],
      },
  select: { id: true, name: true, bio: true, skillsHave: true, skillsWant: true },
    });

    const batchMatches = await Promise.all(
      candidates.map(async (user) => {
        const pairCacheKey = `match:${Math.min(currentUser.id, user.id)}-${Math.max(currentUser.id, user.id)}`;
        const pairCached = await redis.get(pairCacheKey);
        if (pairCached) {
          if (pairCached === '[object Object]') {
            console.warn(`[Match] Corrupted pair cache ${pairCacheKey} -> '[object Object]' (deleting)`);
            await redis.del(pairCacheKey);
          } else {
            const parsedPair = safeParseMaybeJSON(pairCached);
            if (parsedPair) return parsedPair; // valid cached match
            await redis.del(pairCacheKey); // invalid JSON, purge
          }
        }

        const result = await calculateWeightedMatchScore(currentUser, user);
        if (result.matchScore > 0) {
          const match = { ...user, ...result, matchConfidence: getConfidenceLabel(result.matchScore) };
          // Always stringify objects explicitly to avoid accidental '[object Object]'
            await redis.set(pairCacheKey, JSON.stringify(match), { EX: 3600 });
          return match;
        }
        return null;
      })
    );

    const matches = batchMatches.filter(match => match !== null).sort((a, b) => b.matchScore - a.matchScore);
    const aiSuggestions = suggestSkills(currentUser.skillsHave);

    const response = {
      message: matches.length > 0 ? "✅ Matches found!" : "❌ No mutual matches yet",
      totalMatches: matches.length,
      suggestions: aiSuggestions,
      matches,
    };

    await redis.set(cacheKey, JSON.stringify(response), { EX: 3600 });
    res.status(200).json(response);
  } catch (error) {
    console.error("❌ Matchmaking error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const verifySkill = async (req, res) => {
  const { userId, skill, raterId, rating } = req.body;
  try {
    const verification = await prisma.skillVerification.upsert({
      where: { userId_skill: { userId, skill } },
      update: { rating: { increment: rating }, verifiedCount: { increment: 1 } },
      create: { userId, skill, rating, verifiedCount: 1, raterId },
    });
    res.status(200).json({ message: 'Skill verification updated', verification });
  } catch (error) {
    console.error('[Verify] Error updating skill verification:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};