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
  const fuse = new Fuse(skillsB, {
    threshold: 0.4, // adjust for strictness
    includeScore: true,
    keys: [],
  });

  return skillsA.flatMap(skill => {
    const result = fuse.search(skill);
    if (result.length > 0) {
      return result[0].item;
    }
    return [];
  });
}

export function calculateMatchScore(userA, userB) {
  const skillsTheyHave = normalizeSkills(userB.skillsHave);
  const skillsTheyWant = normalizeSkills(userB.skillsWant);
  const skillsIHave = normalizeSkills(userA.skillsHave);
  const skillsIWant = normalizeSkills(userA.skillsWant);

  const matchedHave = fuzzyMatch(skillsIWant, skillsTheyHave); // what I want, they have
  const matchedWant = fuzzyMatch(skillsIHave, skillsTheyWant); // what they want, I have

  // Weighting: mutual match = more valuable
  const weightedScore = matchedHave.length * 2 + matchedWant.length * 2;

  return {
    matchScore: weightedScore,
    matchedHave,
    matchedWant
  };
}

export function getConfidenceLabel(score) {
  if (score >= 8) return '🔥 Strong Match';
  if (score >= 4) return '👌 Medium Match';
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

    const allUsers = await prisma.user.findMany({
      where: {
        id: { not: currentUser.id },
      },
      select: {
        id: true,
        username: true,
        bio: true,
        skillsHave: true,
        skillsWant: true,
      },
    });

    const matches = allUsers.map(user => {
      const { matchScore, matchedHave, matchedWant } = calculateWeightedMatchScore(currentUser, user);
      return {
        user,
        matchScore,
        matchedHave,
        matchedWant,
        matchConfidence: getConfidenceLabel(matchScore),
      };
    })
      .filter(match => match.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);

    const aiSuggestions = suggestSkills(currentUser.skillsHave);

    res.status(200).json({
      message: matches.length > 0 ? "✅ Matches found!" : "❌ No mutual matches yet",
      totalMatches: matches.length,
      suggestions: aiSuggestions,
      matches: matches.map(({ user, matchScore, matchedHave, matchedWant, matchConfidence }) => ({
        ...user,
        matchScore,
        matchedHave,
        matchedWant,
        matchConfidence
      }))
    });

  } catch (error) {
    console.error("❌ Matchmaking error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
