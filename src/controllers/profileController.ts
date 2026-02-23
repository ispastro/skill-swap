import { Request, Response } from 'express';
import prisma from '../config/db.js';
import { checkProfileCompletion } from '../utils/profileUtils.js';
import { normalizeSkills } from './matchController.js';

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
      return res.status(404).json({ message: 'User not found' });
    }

    const { profileCompleted, missing } = checkProfileCompletion(user);

    return res.status(200).json({
      user,
      profileCompleted,
      ...(missing.length > 0 && { missing }),
    });
  } catch (error) {
    console.error('Error in getUserProfile:', error instanceof Error ? error.message : error);
    return res.status(500).json({
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
    });
  }
};

export const updateUserProfile = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { bio, skillsHave, skillsWant } = req.body;

  try {
    const normalizedHave = skillsHave ? await normalizeSkills(skillsHave) : undefined;
    const normalizedWant = skillsWant ? await normalizeSkills(skillsWant) : undefined;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        bio,
        skillsHave,
        skillsWant,
        ...(normalizedHave && { normalizedSkillsHave: normalizedHave }),
        ...(normalizedWant && { normalizedSkillsWant: normalizedWant }),
      },
      select: {
        id: true,
        name: true,
        bio: true,
        skillsHave: true,
        skillsWant: true,
      },
    });

    req.updatedUser = updatedUser;
    res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error in updateUserProfile:', error instanceof Error ? error.message : error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
