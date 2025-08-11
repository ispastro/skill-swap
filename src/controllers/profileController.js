import prisma from '../config/db.js';
import { checkProfileCompletion } from '../utils/profileUtils.js';
import { notifyNewMatches } from '../controllers/notifyController.js';





/**
 * Get the authenticated user's profile.
 */


export const getUserProfile = async (req, res) => {
  const userId = req.user?.id;



  try {
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

    if (!user) {
      return res.status(404).json({ message: "🚫 User not found" });
    }


    const { profileCompleted, missing } = checkProfileCompletion(user);

    if (!profileCompleted) {
      return res.status(200).json({
        message: "📝 Your profile is incomplete. Please update it to unlock full features.",
        missing,
        user: {
          username: user.username,
          email: user.email,
        },
        profileCompleted: false,
      });
    }

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

/**
 * Update the authenticated user's profile and notify matches.
 */
export const updateUserProfile = async (req, res, next) => {
  const userId = req.user.id;
  const { bio, skillsHave, skillsWant } = req.body;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        bio,
        skillsHave,
        skillsWant,
      },
      select: {
        id: true,
        username: true,
        email: true,
        bio: true,
        skillsHave: true,
        skillsWant: true,
      },
    });

    const { profileCompleted, missing } = checkProfileCompletion(updatedUser);

    req.updatedUser = updatedUser; // Pass updated user to notifyNewMatches
    next(); // Proceed to notifyNewMatches
  } catch (error) {
    console.error("❌ Error in updateUserProfile:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};