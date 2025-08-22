import prisma from '../config/db.js';
import { suggestSkills } from '../utils/suggestSkills.js';
import Fuse from 'fuse.js';
import stringSimilarity from 'string-similarity';
import fetch from 'node-fetch';
import redis from '../config/redisClient.js';

// --- Embedding-based Skill Normalization ---
const skillEmbeddingCache = {};

// Fetch embedding from Hugging Face Inference API with caching and fallback
async function fetchSkillEmbedding(skill) {
  const cleaned = skill.toLowerCase().trim().replace(/[^a-z0-9+\-# ]/gi, '');
  const cached = skillEmbeddingCache[cleaned];
  if (cached) return cached;

  try {
    const start = Date.now();
    const response = await fetch('https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.HF_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: cleaned })
    });
    if (!response.ok) {
      const text = await response.text();
      console.error(`[Match] Embedding API error for "${skill}": Status ${response.status} - ${text}`);
      return null;
    }
    let data;
    try {
      data = await response.json();
    } catch (err) {
      const text = await response.text();
      console.error(`[Match] Embedding API JSON parse error for "${skill}": ${err}. Response: ${text}`);
      return null;
    }
    if (!data.embedding) {
      console.error(`[Match] Embedding API response missing 'embedding' for "${skill}":`, data);
      return null;
    }
    const elapsed = Date.now() - start;
    if (elapsed > 2000) console.warn(`[Match] Slow embedding fetch for "${cleaned}" (${elapsed}ms)`);

    if (Array.isArray(data) && Array.isArray(data[0])) {
      skillEmbeddingCache[cleaned] = data[0];
      return data[0];
    }
    throw new Error('Invalid embedding response');
  } catch (err) {
    console.error(`[Match] Embedding fetch error for "${skill}":`, err);
    return null;
  }
}

// Cosine similarity between two embedding vectors
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

// --- Dynamic Synonym Generation ---
async function generateDynamicSynonyms() {
  const cacheKey = 'dynamicSynonyms';
  const cached = await redis.get(cacheKey);
  if (cached) {
    try {
      const parsedCache = JSON.parse(cached);
      if (parsedCache && typeof parsedCache === 'object') {
        console.log('[Match] Synonym cache hit');
        return parsedCache;
      } else {
        console.warn(`[Match] Invalid synonym cache format for ${cacheKey}, clearing cache`);
        await redis.del(cacheKey);
      }
    } catch (parseError) {
      console.error(`[Match] Invalid JSON in synonym cache for ${cacheKey}: ${cached}`, parseError);
      await redis.del(cacheKey);
    }
  }

  // Generate new synonyms
  const skills = await prisma.user.findMany({
    select: { skillsHave: true, skillsWant: true },
  }).then(users => [...new Set(users.flatMap(u => [...u.skillsHave, ...u.skillsWant]))]);

  const embeddings = await Promise.all(skills.map(fetchSkillEmbedding));
  const synonymMap = {};

  for (let i = 0; i < skills.length; i++) {
    for (let j = i + 1; j < skills.length; j++) {
      const embA = embeddings[i];
      const embB = embeddings[j];
      if (embA && embB) {
        const similarity = cosineSimilarity(embA, embB);
        if (similarity > 0.7) {
          const primary = skills[i].length < skills[j].length ? skills[j] : skills[i];
          synonymMap[skills[i]] = synonymMap[skills[i]] || primary;
          synonymMap[skills[j]] = synonymMap[skills[j]] || primary;
        }
      }
    }
  }

  await redis.set(cacheKey, JSON.stringify(synonymMap), { EX: 86400 }); // Ensure stringification
  console.log('[Match] Synonym map generated and cached');
  return synonymMap;
}

// --- Hugging Face Skill Verification ---
async function verifySkillWithHF(skill, bio) {
  try {
    const response = await fetch('https://api-inference.huggingface.co/models/facebook/bart-large-mnli', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: bio,
        parameters: { candidate_labels: [skill] },
        options: { wait_for_model: true }
      })
    });
    const data = await response.json();
    if (data && data.scores && data.scores.length > 0) {
      const confidence = data.scores[0];
      return { verified: confidence > 0.7, confidence };
    }
    throw new Error('Invalid response format');
  } catch (err) {
    console.error('[Match] HF verification error:', err);
    return { verified: false, confidence: 0.5 };
  }
}

function extractYearsOfExperience(bio) {
  if (!bio || typeof bio !== 'string') return 0;
  const match = bio.match(/(\d+)\s*(?:years?|yrs?)/i);
  return match ? parseInt(match[1], 10) : 0;
}

export function normalizeSkills(skills) {
  if (!skills || !Array.isArray(skills)) return [];
  return Promise.all(skills.map(async skill => {
    const synonymMap = await generateDynamicSynonyms();
    const cleaned = skill.toLowerCase().trim().replace(/[^a-z0-9+\-# ]/gi, '');
    return synonymMap[cleaned] || cleaned;
  }));
}

export function fuzzyMatch(skillsA, skillsB) {
  if (!skillsA.length || !skillsB.length) return [];
  const fuse = new Fuse(skillsB, { threshold: 0.4, includeScore: false, includeMatches: true });
  return skillsA.reduce((acc, skill) => {
    const result = fuse.search(skill);
    if (result.length > 0) acc.push(result[0].item);
    return acc;
  }, []);
}

export async function semanticMatch(skillsA, skillsB) {
  if (!skillsA.length || !skillsB.length) return 0;
  let totalSimilarity = 0;
  let validComparisons = 0;
  const threshold = 0.7;
  for (const a of skillsA) {
    const embA = await fetchSkillEmbedding(a);
    for (const b of skillsB) {
      const embB = await fetchSkillEmbedding(b);
      if (embA && embB) {
        const sim = cosineSimilarity(embA, embB);
        if (sim > threshold) {
          totalSimilarity += sim;
          validComparisons++;
        }
      }
    }
  }
  return validComparisons > 0 ? totalSimilarity / validComparisons : 0;
}

export async function calculateWeightedMatchScore(userA, userB) {
  const [skillsTheyHave, skillsTheyWant, skillsIHave, skillsIWant] = await Promise.all([
    normalizeSkills(userB.skillsHave),
    normalizeSkills(userB.skillsWant),
    normalizeSkills(userA.skillsHave),
    normalizeSkills(userA.skillsWant),
  ]);

  const matchedHave = fuzzyMatch(skillsIWant, skillsTheyHave);
  const matchedWant = fuzzyMatch(skillsIHave, skillsTheyWant);

  // Fuzzy score
  const totalPossible = new Set([...skillsTheyHave, ...skillsTheyWant, ...skillsIHave, ...skillsIWant]).size;
  const fuzzyMatched = matchedHave.length + matchedWant.length;
  const fuzzyScore = totalPossible > 0 ? fuzzyMatched / totalPossible : 0;

  // Semantic score (async)
  const semanticScoreHave = await semanticMatch(skillsIWant, skillsTheyHave);
  const semanticScoreWant = await semanticMatch(skillsIHave, skillsTheyWant);
  const semanticScore = (semanticScoreHave + semanticScoreWant) / 2;

  // Experience and verification boost
  const yearsA = extractYearsOfExperience(userA.bio);
  const yearsB = extractYearsOfExperience(userB.bio);
  const expBoost = Math.min((yearsA + yearsB) / 20, 0.1);

  // Hugging Face verification boost
  let verificationBoost = 0;
  const matchedSkills = [...matchedHave, ...matchedWant];
  if (matchedSkills.length > 0) {
    const verifications = await Promise.all(matchedSkills.map(skill =>
      verifySkillWithHF(skill, userB.bio)
    ));
    const avgConfidence = verifications.reduce((sum, v) => sum + v.confidence, 0) / verifications.length;
    verificationBoost = Math.min(avgConfidence * 0.2, 0.2);
  }

  // Hybrid score: 60% fuzzy + 25% semantic + 10% experience + 5% verification
  let hybridScore = 0.6 * fuzzyScore + 0.25 * semanticScore + 0.1 * expBoost + 0.05 * verificationBoost;
  hybridScore = Math.min(hybridScore, 1);
  const matchScore = Math.round(hybridScore * 100);

  return {
    matchScore,
    matchedHave,
    matchedWant,
    verificationConfidence: verificationBoost * 100
  };
}

export function getConfidenceLabel(score) {
  if (score >= 80) return '🔥 Strong Match';
  if (score >= 40) return '👌 Medium Match';
  return '🙂 Light Match';
}

export const findSkillsMatches = async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const cacheKey = `matches:${currentUser.id}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        const parsedCache = JSON.parse(cached);
        if (parsedCache && typeof parsedCache === 'object' && 'matches' in parsedCache) {
          console.log(`[Match] Cache hit for user ${currentUser.id}`);
          return res.status(200).json(parsedCache);
        } else {
          console.warn(`[Match] Invalid cache format for ${cacheKey}, clearing cache`);
          await redis.del(cacheKey);
        }
      } catch (parseError) {
        console.error(`[Match] Invalid JSON in cache for ${cacheKey}: ${cached}`, parseError);
        await redis.del(cacheKey);
      }
    }

    let page = 0;
    let hasMore = true;
    const matches = [];
    const batchSize = 100;

    while (hasMore) {
      const users = await prisma.user.findMany({
        skip: page * batchSize,
        take: batchSize,
        where: { id: { not: currentUser.id } },
        select: { id: true, username: true, bio: true, skillsHave: true, skillsWant: true },
      });

      if (!users.length) {
        hasMore = false;
        break;
      }

      const batchMatches = await Promise.all(
        users.map(async (user) => {
          const result = await calculateWeightedMatchScore(currentUser, user);
          if (result.matchScore > 0) {
            return {
              ...user,
              ...result,
              matchConfidence: getConfidenceLabel(result.matchScore),
            };
          }
          return null;
        })
      );

      matches.push(...batchMatches.filter(match => match !== null));
      page++;
    }

    matches.sort((a, b) => b.matchScore - a.matchScore);
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