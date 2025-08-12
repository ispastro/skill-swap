// findSkillMatches.js

import prisma from '../config/db.js';
import redis from '../config/redisClient.js'; // your provided Redis instance
import fuzzysort from 'fuzzysort';

// Configurable constants
const PAGE_SIZE = 500; // number of users fetched per DB query
const CACHE_TTL = 60 * 5; // 5 minutes cache
const MIN_SCORE = -5000; // fuzzy score threshold

/**
 * Normalize skills for better matching.
 */
function normalizeSkill(skill) {
  return skill.trim().toLowerCase();
}

/**
 * Get skill matches for a given user.
 * @param {string} currentUserId - The ID of the user to match.
 * @returns {Promise<Array>} - List of matches with score.
 */
export async function findSkillMatches(currentUserId) {
  const cacheKey = `matches:${currentUserId}`;
  
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log('Cache hit');
    return cached;
  }

  // Fetch current user
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { id: true, skills: true },
  });

  if (!currentUser || !currentUser.skills?.length) {
    return [];
  }

  const normalizedSkills = currentUser.skills.map(normalizeSkill);
  let matches = [];

  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const users = await prisma.user.findMany({
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
      where: {
        id: { not: currentUserId },
        skills: { hasSome: currentUser.skills }, // DB-side pre-filter
      },
      select: { id: true, name: true, skills: true },
    });

    if (users.length === 0) {
      hasMore = false;
      break;
    }

    // Score matches
    for (const user of users) {
      const score = fuzzysort.single(
        normalizedSkills.join(' '),
        user.skills.map(normalizeSkill).join(' ')
      )?.score ?? -Infinity;

      if (score >= MIN_SCORE) {
        matches.push({
          id: user.id,
          name: user.name,
          score,
        });
      }
    }

    page++;
  }

  // Sort by score desc
  matches.sort((a, b) => b.score - a.score);

  // Cache results
  await redis.set(cacheKey, matches, { ex: CACHE_TTL });

  return matches;
}
