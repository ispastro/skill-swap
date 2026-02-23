import { Request, Response } from 'express';
import prisma from '../config/db.js';
import winston from 'winston';

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

        const updatedUser = await prisma.user.findUnique({
            where: { id: rawUser.id },
            select: {
                id: true, name: true, bio: true,
                skillsHave: true, skillsWant: true,
            },
        });
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const { profileCompleted, missing } = checkProfileCompletion(updatedUser);
        const responseMessage = profileCompleted
            ? '🎉 Profile updated successfully!'
            : '✅ Profile updated, but still incomplete.';
        
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
