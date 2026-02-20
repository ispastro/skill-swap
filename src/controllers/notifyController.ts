import { Request, Response } from 'express';
import prisma from '../config/db.js';
import winston from 'winston';
import { calculateWeightedMatchScore } from './matchController.js';
import { checkProfileCompletion } from '../utils/profileUtils.js';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    transports: [new winston.transports.Console()],
});

export const notifyNewMatches = async (req: Request, res: Response): Promise<Response> => {
    try {
        const rawUser = req.updatedUser;
        if (!rawUser) {
            return res.status(400).json({ message: 'No user data provided' });
        }

        // Fetch full user with normalized skills for matching
        const updatedUser = await prisma.user.findUnique({
            where: { id: rawUser.id },
            select: {
                id: true, name: true, bio: true,
                skillsHave: true, skillsWant: true,
                normalizedSkillsHave: true, normalizedSkillsWant: true,
            },
        });
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const users = await prisma.user.findMany({
            where: { id: { not: updatedUser.id } },
            select: {
                id: true, name: true, bio: true,
                skillsHave: true, skillsWant: true,
                normalizedSkillsHave: true, normalizedSkillsWant: true,
            },
            take: 200,
        });

        const notificationsSent: { recipientId: string; message: string }[] = [];
        for (const user of users) {
            const result = await calculateWeightedMatchScore(updatedUser, user);
            if (result.matchScore >= 80) {
                const message = `You have a new match with ${updatedUser.name} (${result.matchScore}% match)`;
                await prisma.notification.create({
                    data: {
                        senderId: updatedUser.id,
                        recipientId: user.id,
                        message,
                    },
                });
                req.io?.to(user.id).emit('notification', {
                    notificationId: `${updatedUser.id}-${user.id}-${Date.now()}`,
                    message,
                    sender: { id: updatedUser.id, name: updatedUser.name },
                });
                notificationsSent.push({ recipientId: user.id, message });
                logger.info(`Match notification sent to ${user.id}: ${message}`);
            }
        }

        const { profileCompleted, missing } = checkProfileCompletion(updatedUser);
        const responseMessage = profileCompleted
            ? '🎉 Profile updated successfully! Matches notified.'
            : '✅ Profile updated, but still incomplete. Matches notified.';
        return res.status(200).json({
            message: responseMessage,
            user: updatedUser,
            profileCompleted,
            ...(missing.length > 0 && { missing }),
        });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Error in notifyNewMatches:', { message: errMsg });
        return res.status(500).json({ message: 'Server error', error: errMsg });
    }
};

export const sendNotification = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { recipientId, message } = req.body;
        const senderId = req.user!.id;

        if (recipientId === senderId) {
            return res.status(400).json({ message: 'Cannot send notification to yourself' });
        }

        const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
        if (!recipient) {
            return res.status(404).json({ message: 'Recipient not found' });
        }

        const notification = await prisma.notification.create({
            data: { senderId, recipientId, message },
            select: {
                id: true,
                message: true,
                createdAt: true,
                sender: { select: { id: true, name: true } },
                recipient: { select: { id: true, name: true } },
            },
        });

        req.io?.to(recipientId).emit('notification', {
            notificationId: notification.id,
            message: notification.message,
            sender: notification.sender,
        });

        logger.info(`Notification sent from ${senderId} to ${recipientId}: ${message}`);
        return res.status(201).json(notification);
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Error in sendNotification:', { message: errMsg });
        return res.status(500).json({ message: 'Server error', error: errMsg });
    }
};
