import prisma from '../config/db.js';

/**
 * Get the authenticated user's profile.
 */
export const getUserProfile = async (req, res) => {
  const userId = req.user?.id;

  try {
    // Fetch user info from the DB
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        email: true,
        bio: true,
        skillsHave: true,
        skillsWant: true,
      },
    });

    // User not found
    if (!user) {
      return res.status(404).json({ message: "🚫 User not found" });
    }

    // Determine profile completion
    const profileCompleted =
      Boolean(user.bio) &&
      Array.isArray(user.skillsHave) && user.skillsHave.length > 0 &&
      Array.isArray(user.skillsWant) && user.skillsWant.length > 0;

    // Response if profile incomplete
    if (!profileCompleted) {
      return res.status(200).json({
        message: "📝 Your profile is incomplete. Please update it to unlock full features.",
        user: {
          username: user.username,
          email: user.email,
        },
        profileCompleted: false,
      });
    }

    // Response if profile complete
    return res.status(200).json({
      message: "✅ Welcome to your dashboard!",
      user,
      profileCompleted: true,
    });

  } catch (error) {
    console.error("❌ Error in getUserProfile:", error.message);
    return res.status(500).json({
      message: "💥 Server error. Please try again later.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
