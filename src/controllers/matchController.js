
import prisma from '../config/db.js';
import { suggestSkills } from '../utils/suggestSkills.js';
import Fuse from 'fuse.js';


export function normalizeSkills(skills) {
  if (!skills || !Array.isArray(skills)) return [];
  return skills.map(skill =>
    skill.toLowerCase().trim().replace(/[^a-z0-9+\-# ]/gi, '')
  );
}





export function fuzzyMatch(skillsA, skillsB) {
  if (!skillsA.length || !skillsB.length) return [];
  const fuse = new Fuse(skillsB, {
    threshold: 0.4,
    includeScore: false,
    keys: [],
  });
  return skillsA.reduce((acc, skill) => {
    const result = fuse.search(skill);
    if (result.length > 0) acc.push(result[0].item);
    return acc;
  }, []);
}


export function calculateWeightedMatchScore(userA, userB) {
  const skillsTheyHave = normalizeSkills(userB.skillsHave);
  const skillsTheyWant = normalizeSkills(userB.skillsWant);
  const skillsIHave = normalizeSkills(userA.skillsHave);
  const skillsIWant = normalizeSkills(userA.skillsWant);

  const matchedHave = fuzzyMatch(skillsIWant, skillsTheyHave); // what I want, they have
  const matchedWant = fuzzyMatch(skillsIHave, skillsTheyWant); // what they want, I have

  // Calculate professional percentage match score
  const totalPossible = new Set([
    ...skillsTheyHave,
    ...skillsTheyWant,
    ...skillsIHave,
    ...skillsIWant
  ]).size;
  const totalMatched = matchedHave.length + matchedWant.length;
  const matchScore = totalPossible > 0 ? Math.round((totalMatched / totalPossible) * 100) : 0;

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

    while (hasMore) {
      const users = await prisma.user.findMany({
        skip: page * 100,
        take: 100,
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
      for (const user of users) {
        const { matchScore, matchedHave, matchedWant } = calculateWeightedMatchScore(currentUser, user);
        if (matchScore > 0) {
          matches.push({
            ...user,
            matchScore,
            matchedHave,
            matchedWant,
            matchConfidence: getConfidenceLabel(matchScore),
          });
        }
      }
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
