// controllers/matchController.js

import prisma from '../config/db.js';

export const findSkillsMatches = async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const matches = await prisma.user.findMany({
      where: {
        id: { not: currentUser.id }, // Don’t match with self
        skillsHave: { hasSome: currentUser.skillsWant }, // They HAVE what I WANT
        skillsWant: { hasSome: currentUser.skillsHave }, // They WANT what I HAVE
      },
      select: {
        
        username: true,
        bio: true,
        skillsHave: true,
        skillsWant: true,
      },
    });

    res.status(200).json({
      message: matches.length > 0 ? "✅ Matches found!" : "❌ No mutual matches yet",
      matches,
    });

  } catch (error) {
    console.error("Matchmaking error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
