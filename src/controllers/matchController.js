

import prisma from '../config/db.js';
import { suggestSkills } from '../utils/suggestSkills.js';
import Fuse from 'fuse.js';
import stringSimilarity from 'string-similarity';
import fetch from 'node-fetch';


// --- Embedding-based Skill Normalization ---
// In-memory cache for skill embeddings
const skillEmbeddingCache = {};

// Fetch embedding from Hugging Face Inference API (all-MiniLM-L6-v2) with logging and fallback
async function fetchSkillEmbedding(skill) {
  const cleaned = skill.toLowerCase().trim();
  if (skillEmbeddingCache[cleaned]) return skillEmbeddingCache[cleaned];
  try {
    const start = Date.now();
    const response = await fetch('https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: cleaned })
    });
    const data = await response.json();
    const elapsed = Date.now() - start;
    if (elapsed > 2000) {
      console.warn(`[Match] Slow embedding fetch for "${cleaned}" (${elapsed}ms)`);
    }
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

// Cosine similarity between two embedding arrays
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

// --- Experience Parsing ---
function extractYearsOfExperience(bio) {
  if (!bio || typeof bio !== 'string') return 0;
  const match = bio.match(/(\d+)\s*(?:years?|yrs?)/i);
  return match ? parseInt(match[1], 10) : 0;
}

export function normalizeSkills(skills) {
  if (!skills || !Array.isArray(skills)) return [];
  return skills.map(skill => skill.toLowerCase().trim().replace(/[^a-z0-9+\-# ]/gi, ''));
}

export function fuzzyMatch(skillsA, skillsB) {
  if (!skillsA.length || !skillsB.length) return [];
  const fuse = new Fuse(skillsB, {
    threshold: 0.4,
    includeScore: false,
    includeMatches: true,
  });
  return skillsA.reduce((acc, skill) => {
    const result = fuse.search(skill);
    if (result.length > 0) acc.push(result[0].item);
    return acc;
  }, []);
}

// --- Semantic match using embeddings (async) ---
export async function semanticMatch(skillsA, skillsB) {
  if (!skillsA.length || !skillsB.length) return 0;
  let totalSimilarity = 0;
  let comparisons = 0;
  let usedFallback = false;
  const threshold = 0.8; // Only count as semantic match if above this
  for (const a of skillsA) {
    let embA = await fetchSkillEmbedding(a);
    for (const b of skillsB) {
      let embB = await fetchSkillEmbedding(b);
      let sim = 0;
      if (embA && embB) {
        sim = cosineSimilarity(embA, embB);
      } else {
        // Fallback to string similarity if embedding fails
        sim = stringSimilarity.compareTwoStrings(a, b);
        usedFallback = true;
      }
      // Only count as a match if above threshold
      if (sim > threshold) {
        totalSimilarity += sim;
        comparisons++;
      }
    }
  }
  if (usedFallback) {
    console.warn('[Match] Fallback to string similarity used for some skills.');
  }
  return comparisons > 0 ? totalSimilarity / comparisons : 0;
}

// Now async because semanticMatch is async
export async function calculateWeightedMatchScore(userA, userB) {
  const skillsTheyHave = normalizeSkills(userB.skillsHave);
  const skillsTheyWant = normalizeSkills(userB.skillsWant);
  const skillsIHave = normalizeSkills(userA.skillsHave);
  const skillsIWant = normalizeSkills(userA.skillsWant);

  const matchedHave = fuzzyMatch(skillsIWant, skillsTheyHave); // what I want, they have
  const matchedWant = fuzzyMatch(skillsIHave, skillsTheyWant); // what they want, I have

  // Calculate fuzzy match score (weighted)
  const totalPossible = new Set([
    ...skillsTheyHave,
    ...skillsTheyWant,
    ...skillsIHave,
    ...skillsIWant
  ]).size;
  const fuzzyMatched = matchedHave.length + matchedWant.length;
  const fuzzyScore = totalPossible > 0 ? fuzzyMatched / totalPossible : 0;

  // Calculate semantic match score (async)
  const semanticScoreHave = await semanticMatch(skillsIWant, skillsTheyHave);
  const semanticScoreWant = await semanticMatch(skillsIHave, skillsTheyWant);
  const semanticScore = (semanticScoreHave + semanticScoreWant) / 2;

  // --- Experience boost ---
  const yearsA = extractYearsOfExperience(userA.bio);
  const yearsB = extractYearsOfExperience(userB.bio);
  // Give a small boost for more experience (max 10% boost for 10+ years)
  const expBoost = Math.min((yearsA + yearsB) / 20, 0.1); // max 0.1 (10%)

  // Hybrid score: 70% fuzzy + 30% semantic for balance, then add exp boost
  let hybridScore = 0.7 * fuzzyScore + 0.3 * semanticScore;
  hybridScore = Math.min(hybridScore + expBoost, 1); // cap at 1
  const matchScore = Math.round(hybridScore * 100);

  return {
    matchScore,
    matchedHave,
    matchedWant
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

    // Stream users in pages for memory efficiency
    let page = 0;
    let hasMore = true;
    const matches = [];
    const batchSize = 100;

    while (hasMore) {
      const users = await prisma.user.findMany({
        skip: page * batchSize,
        take: batchSize,
        where: { id: { not: currentUser.id } },
        select: {
          id: true,
          username: true,
          bio: true,
          skillsHave: true,
          skillsWant: true,
        },
      });

      if (!users.length) {
        hasMore = false;
        break;
      }

      // Process batch in parallel for speed
      const batchMatches = await Promise.all(
        users.map(async (user) => {
          const { matchScore, matchedHave, matchedWant } = await calculateWeightedMatchScore(currentUser, user);
          if (matchScore > 0) {
            return {
              ...user,
              matchScore,
              matchedHave,
              matchedWant,
              matchConfidence: getConfidenceLabel(matchScore),
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

    res.status(200).json({
      message: matches.length > 0 ? "✅ Matches found!" : "❌ No mutual matches yet",
      totalMatches: matches.length,
      suggestions: aiSuggestions,
      matches
    });

  } catch (error) {
    console.error("❌ Matchmaking error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};