import { Request, Response } from 'express';
import prisma from '../config/db.js';
import redis from '../config/redisClient.js';
import winston from 'winston';
import { isUserOnline } from '../sockets/socketHandler.js';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [new winston.transports.Console()],
});

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Verify that a user is a participant of a chat session.
 * Returns the chat if authorized, null otherwise.
 */
async function verifyChatParticipant(chatId: string, userId: string) {
    const chat = await prisma.chatSession.findUnique({
        where: { id: chatId },
        select: { initiatorId: true, recipientId: true },
    });
    if (!chat || ![chat.initiatorId, chat.recipientId].includes(userId)) {
        return null;
    }
    return chat;
}

/**
 * Invalidate all cached message pages for a chat.
 * Deletes keys for common page sizes across the first 10 pages in parallel.
 * Any missed keys will expire naturally via TTL (5 min).
 */
async function invalidateMessageCache(chatId: string): Promise<void> {
    try {
        const pageSizes = [20, 50, 100];
        const maxPages = 10;
        const keysToDelete: string[] = [];

        for (const size of pageSizes) {
            for (let page = 1; page <= maxPages; page++) {
                keysToDelete.push(`chat:${chatId}:messages:page:${page}:size:${size}`);
            }
        }

        await Promise.all(keysToDelete.map(key => redis.del(key)));
        logger.info('Cache invalidated', { chatId, keysDeleted: keysToDelete.length });
    } catch (err) {
        // Cache invalidation failure is non-fatal — stale data will expire via TTL
        logger.warn('Cache invalidation failed (non-fatal)', { chatId, error: err });
    }
}

// ─── Controllers ───────────────────────────────────────────────

export const initiateChat = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { recipientId } = req.body;
        const initiatorId = req.user!.id;

        if (initiatorId === recipientId) {
            return res.status(400).json({ message: 'Cannot initiate chat with yourself' });
        }

        const recipient = await prisma.user.findUnique({
            where: { id: recipientId },
            select: { id: true, name: true },
        });

        if (!recipient) {
            return res.status(404).json({ message: 'Recipient not found' });
        }

        const existingChat = await prisma.chatSession.findFirst({
            where: {
                OR: [
                    { initiatorId, recipientId },
                    { initiatorId: recipientId, recipientId: initiatorId },
                ],
            },
        });

        if (existingChat) {
            return res.status(200).json({ chatId: existingChat.id, message: 'Chat session already exists' });
        }

        const chatSession = await prisma.chatSession.create({
            data: { initiatorId, recipientId },
            include: {
                initiator: { select: { name: true } },
                recipient: { select: { name: true } },
            },
        });

        if (req.io) {
            req.io.to(recipientId).emit('chatInitiated', {
                chatId: chatSession.id,
                initiator: { id: initiatorId, name: chatSession.initiator.name },
            });
        }

        logger.info('Chat initiated', { chatId: chatSession.id, initiatorId, recipientId });
        return res.status(201).json({ chatId: chatSession.id, message: 'Chat session created' });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Chat initiation error', { error: errMsg, userId: req.user?.id });
        return res.status(500).json({ message: 'Server error', error: errMsg });
    }
};

export const getChats = async (req: Request, res: Response): Promise<Response> => {
    try {
        const userId = req.user!.id;

        const chats = await prisma.chatSession.findMany({
            where: {
                OR: [{ initiatorId: userId }, { recipientId: userId }],
            },
            include: {
                initiator: { select: { id: true, name: true } },
                recipient: { select: { id: true, name: true } },
                // Include last message for preview
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                        id: true,
                        content: true,
                        senderId: true,
                        createdAt: true,
                        readAt: true,
                    },
                },
            },
            orderBy: { updatedAt: 'desc' },
        });

        // Enrich with unread count and online status
        const enrichedChats = await Promise.all(
            chats.map(async (chat) => {
                const otherUserId = chat.initiatorId === userId ? chat.recipientId : chat.initiatorId;
                const [unreadCount, online] = await Promise.all([
                    prisma.message.count({
                        where: { chatId: chat.id, recipientId: userId, readAt: null },
                    }),
                    isUserOnline(otherUserId),
                ]);

                const lastMessage = chat.messages[0] ?? null;
                const { messages: _, ...chatData } = chat;

                return { ...chatData, lastMessage, unreadCount, otherUserOnline: online };
            })
        );

        return res.status(200).json(enrichedChats);
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Fetch chats error', { error: errMsg, userId: req.user?.id });
        return res.status(500).json({ message: 'Server error', error: errMsg });
    }
};

export const getMessages = async (req: Request, res: Response): Promise<Response> => {
    try {
        const chatId = req.params.chatId as string;
        const userId = req.user!.id;
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
        const offset = (page - 1) * pageSize;

        const chat = await verifyChatParticipant(chatId, userId);
        if (!chat) {
            return res.status(403).json({ message: 'Unauthorized access to chat' });
        }

        // Check cache
        const cacheKey = `chat:${chatId}:messages:page:${page}:size:${pageSize}`;
        const cachedMessages = await redis.get(cacheKey);
        if (cachedMessages && cachedMessages !== '') {
            try {
                const parsed = typeof cachedMessages === 'string' ? JSON.parse(cachedMessages) : cachedMessages;
                return res.status(200).json(parsed);
            } catch {
                await redis.del(cacheKey);
            }
        }

        const [messages, totalCount] = await Promise.all([
            prisma.message.findMany({
                where: { chatId },
                include: {
                    sender: { select: { name: true } },
                },
                orderBy: { createdAt: 'asc' },
                skip: offset,
                take: pageSize,
            }),
            prisma.message.count({ where: { chatId } }),
        ]);

        const result = {
            messages,
            pagination: {
                page,
                pageSize,
                totalCount,
                totalPages: Math.ceil(totalCount / pageSize),
            },
        };

        await redis.set(cacheKey, JSON.stringify(result), { ex: 300 }); // 5 min TTL (not 1 hour — messages change frequently)

        return res.status(200).json(result);
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Fetch messages error', { error: errMsg, chatId: req.params.chatId });
        return res.status(500).json({ message: 'Server error', error: errMsg });
    }
};

export const sendMessage = async (req: Request, res: Response): Promise<Response> => {
    try {
        const chatId = req.params.chatId as string;
        const { content } = req.body;
        const senderId = req.user!.id;

        const chat = await verifyChatParticipant(chatId, senderId);
        if (!chat) {
            return res.status(403).json({ message: 'Unauthorized access to chat' });
        }

        const recipientId = chat.initiatorId === senderId ? chat.recipientId : chat.initiatorId;

        // Create message and update chat session's updatedAt in a single transaction
        const [message] = await prisma.$transaction([
            prisma.message.create({
                data: { chatId, senderId, recipientId, content },
                include: { sender: { select: { name: true } } },
            }),
            prisma.chatSession.update({
                where: { id: chatId },
                data: { updatedAt: new Date() },
            }),
        ]);

        // Invalidate cache in background (non-blocking)
        invalidateMessageCache(chatId);

        if (req.io) {
            req.io.to(chatId).emit('newMessage', message);
            req.io.to(recipientId).emit('newMessageNotification', {
                chatId,
                message: { id: message.id, content, sender: message.sender },
            });
        }

        logger.info('Message sent', { chatId, senderId, messageId: message.id });
        return res.status(201).json(message);
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Send message error', { error: errMsg, chatId: req.params.chatId });
        return res.status(500).json({ message: 'Server error', error: errMsg });
    }
};

export const markMessagesRead = async (req: Request, res: Response): Promise<Response> => {
    try {
        const chatId = req.params.chatId as string;
        const userId = req.user!.id;

        const chat = await verifyChatParticipant(chatId, userId);
        if (!chat) {
            return res.status(403).json({ message: 'Unauthorized access to chat' });
        }

        const result = await prisma.message.updateMany({
            where: {
                chatId,
                recipientId: userId,
                readAt: null,
            },
            data: { readAt: new Date() },
        });

        // Notify sender that their messages were read
        if (req.io && result.count > 0) {
            const senderId = chat.initiatorId === userId ? chat.recipientId : chat.initiatorId;
            req.io.to(senderId).emit('messagesRead', { chatId, readBy: userId, count: result.count });
        }

        return res.status(200).json({ markedRead: result.count });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Mark read error', { error: errMsg, chatId: req.params.chatId });
        return res.status(500).json({ message: 'Server error', error: errMsg });
    }
};

export const getChatSession = async (req: Request, res: Response): Promise<Response> => {
    try {
        const userA = req.query.userA as string | undefined;
        const userB = req.query.userB as string | undefined;
        if (!userA || !userB) return res.status(400).json({ chatId: null });

        const session = await prisma.chatSession.findFirst({
            where: {
                OR: [
                    { initiatorId: userA, recipientId: userB },
                    { initiatorId: userB, recipientId: userA },
                ],
            },
        });
        return res.status(200).json({ chatId: session ? session.id : null });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ message: 'Server error', error: errMsg });
    }
};
