import prisma from '../config/db.js';
import winston from 'winston';
import { validationResult } from 'express-validator';
import { calculateWeightedMatchScore } from './matchController.js';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

// Function to check profile completion
function checkProfileCompletion(profile) {
  const missing = [];
  if (!profile.bio || profile.bio.trim() === '') missing.push('bio');
  if (!profile.skillsHave || profile.skillsHave.length === 0) missing.push('skillsHave');
  if (!profile.skillsWant || profile.skillsWant.length === 0) missing.push('skillsWant');
  return { profileCompleted: missing.length === 0, missing };
}

export const notifyNewMatches = async (req, res) => {
  try {
    const updatedUser = req.updatedUser;
    if (!updatedUser) {
      return res.status(400).json({ message: 'No user data provided' });
    }

    const users = await prisma.user.findMany({
      where: { id: { not: updatedUser.id } },
      select: { id: true, username: true, skillsHave: true, skillsWant: true },
    });

    const notificationsSent = [];
    for (const user of users) {
      const matchScore = calculateWeightedMatchScore(updatedUser, user);
      if (matchScore >= 0.8) { // 80% match threshold
        const message = `You have a new match with ${updatedUser.username} (${(matchScore * 100).toFixed(0)}% match)`;
        await prisma.notification.create({
          data: {
            senderId: updatedUser.id,
            recipientId: user.id,
            message,
          },
        });
        req.io.to(user.id).emit('notification', {
          notificationId: `${updatedUser.id}-${user.id}-${Date.now()}`, // Unique ID
          message,
          sender: { id: updatedUser.id, username: updatedUser.username },
        });
        notificationsSent.push({ recipientId: user.id, message });
        logger.info(`Match notification sent to ${user.id}: ${message}`);
      }
    }

    const { profileCompleted, missing } = checkProfileCompletion(updatedUser);
    const responseMessage = profileCompleted
      ? "🎉 Profile updated successfully! Matches notified."
      : "✅ Profile updated, but still incomplete. Matches notified.";
    res.status(200).json({
      message: responseMessage,
      user: updatedUser,
      profileCompleted,
      ...(missing.length > 0 && { missing }),
    });
  } catch (error) {
    logger.error('Error in notifyNewMatches:', { message: error.message, stack: error.stack });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const sendNotification = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Invalid input', errors: errors.array() });
    }

    const { recipientId, message } = req.body;
    const senderId = req.user.id;

    if (recipientId === senderId) {
      return res.status(400).json({ message: 'Cannot send notification to yourself' });
    }

    const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    const notification = await prisma.notification.create({
      data: {
        senderId,
        recipientId,
        message,
      },
      select: {
        id: true,
        message: true,
        createdAt: true,
        sender: { select: { id: true, username: true } },
        recipient: { select: { id: true, username: true } },
      },
    });

    req.io.to(recipientId).emit('notification', {
      notificationId: notification.id,
      message: notification.message,
      sender: notification.sender,
    });

    logger.info(`Notification sent from ${senderId} to ${recipientId}: ${message}`);
    res.status(201).json(notification);
  } catch (error) {
    logger.error('Error in sendNotification:', { message: error.message, stack: error.stack });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};