import { Request, Response, NextFunction } from 'express';
// @ts-ignore
import prisma from '../config/db.js';
// @ts-ignore
import { checkProfileCompletion } from '../utils/profileUtils.js';

export const getUserProfile = async (req: Request, res: Response): Promise<Response> => {
  const userId = req.user?.id;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
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
          id: user.id,
          name: user.name,
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
    console.error("❌ Error in getUserProfile:", error instanceof Error ? error.message : error);
    return res.status(500).json({
      message: "💥 Server error. Please try again later.",
      error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
    });
  }
};

export const updateUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user!.id;
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
        name: true,
        email: true,
        bio: true,
        skillsHave: true,
        skillsWant: true,
      },
    });

    req.updatedUser = updatedUser;
    next();
  } catch (error) {
    console.error("❌ Error in updateUserProfile:", error instanceof Error ? error.message : error);
    res.status(500).json({ message: "Server error", error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
