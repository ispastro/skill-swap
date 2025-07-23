import prisma from '../config/db.js';
import { suggestSkills } from '../utils/suggestSkills.js';

function normalizeSkills(skills) {
  return skills.map(skill => skill.toLowerCase().trim());
}

function calculateMatchScore(userA, userB) {
  const skillsTheyHave = normalizeSkills(userB.skillsHave);
  const skillsIWant = normalizeSkills(userA.skillsWant);

  const skillsTheyWant = normalizeSkills(userB.skillsWant);
  const skillsIHave = normalizeSkills(userA.skillsHave);

  const matchedHave = skillsTheyHave.filter(skill => skillsIWant.includes(skill));
  const matchedWant = skillsTheyWant.filter(skill => skillsIHave.includes(skill));

  const totalMatches = matchedHave.length + matchedWant.length;

  return {
    matchScore: totalMatches,
    matchedHave,
    matchedWant
  };
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
      const { matchScore, matchedHave, matchedWant } = calculateMatchScore(currentUser, user);
      return {
        user,
        matchScore,
        matchedHave,
        matchedWant
      };
    })
    .filter(match => match.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore);

    const aiSuggestions = suggestSkills(currentUser.skillsHave);

    res.status(200).json({
      message: matches.length > 0 ? "✅ Matches found!" : "❌ No mutual matches yet",
      totalMatches: matches.length,
      suggestions: aiSuggestions,
      matches: matches.map(({ user, matchScore, matchedHave, matchedWant }) => ({
        ...user,
        matchScore,
        matchedHave,
        matchedWant
      }))
    });

  } catch (error) {
    console.error("❌ Matchmaking error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
