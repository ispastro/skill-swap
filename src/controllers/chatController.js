import prisma from '../config/db.js';
import redis from '../config/redisClient.js';
import winston from 'winston';
import { body, param, validationResult }  from 'express-validator';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// Validation middleware
export const validateChatInitiation = [
  body('recipientId').isUUID().withMessage('Invalid recipient ID'),
];

export const validateMessage = [
  param('chatId').isUUID().withMessage('Invalid chat ID'),
  body('content').isString().trim().notEmpty().withMessage('Message content is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.info('Validation errors for', req.method, req.url, ':', errors.array());
      return res.status(400).json({ message: 'Invalid input', errors: errors.array() });
    }
    next();
  },
];

// create validator that only validated the chatId
export const validateChatId = [
  param('chatId').isUUID().withMessage('Invalid chat ID'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.info('Validation errors for', req.method, req.url, ':', errors.array());
      return res.status(400).json({ message: 'Invalid input', errors: errors.array() });
    }
    next();
  },
];

// Initiate a chat session
export const initiateChat = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.info('Validation errors for initiateChat:', errors.array());
      return res.status(400).json({ message: 'Invalid input', errors: errors.array() });
    }

    const { recipientId } = req.body;
    const initiatorId = req.user.id;

    if (initiatorId === recipientId) {
      return res.status(400).json({ message: 'Cannot initiate chat with yourself' });
    }

    // Check if recipient exists
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true, username: true },
    });

    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    // Check if chat session already exists
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

    // Create new chat session
    const chatSession = await prisma.chatSession.create({
      data: {
        initiatorId,
        recipientId,
      },
      include: {
        initiator: { select: { username: true } },
        recipient: { select: { username: true } },
      },
    });

    // Emit WebSocket notification to recipient
    if (req.io) {
      req.io.to(recipientId).emit('chatInitiated', {
        chatId: chatSession.id,
        initiator: { id: initiatorId, username: chatSession.initiator.username },
      });
    }

    logger.info('Chat initiated', { chatId: chatSession.id, initiatorId, recipientId });
    res.status(201).json({ chatId: chatSession.id, message: 'Chat session created' });
  } catch (error) {
    logger.error('Chat initiation error', { error: error.message, userId: req.user.id });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user's chat sessions
export const getChats = async (req, res) => {
  try {
    const userId = req.user.id;
    logger.info('Fetching chats for user', { userId });

    const chats = await prisma.chatSession.findMany({
      where: {
        OR: [{ initiatorId: userId }, { recipientId: userId }],
      },
      include: {
        initiator: { select: { id: true, username: true } },
        recipient: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json(chats);
  } catch (error) {
    logger.error('Fetch chats error', { error: error.message, userId: req.user.id });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Get messages for a chat session (with pagination and efficient cache)
export const getMessages = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.info('Validation errors for getMessages:', errors.array());
      return res.status(400).json({ message: 'Invalid input', errors: errors.array() });
    }

    const { chatId } = req.params;
    const userId = req.user.id;
    // Pagination params
    const page = parseInt(req.query.page) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize) || 20, 100); // max 100 per page
    const offset = (page - 1) * pageSize;
    logger.info('Fetching messages for chat', { chatId, userId, page, pageSize });

    // Verify user is part of the chat
    const chat = await prisma.chatSession.findUnique({
      where: { id: chatId },
      select: { initiatorId: true, recipientId: true },
    });


    
    if (!chat || ![chat.initiatorId, chat.recipientId].includes(userId)) {
      logger.info('Unauthorized chat access attempt', { chatId, userId });
      return res.status(403).json({ message: 'Unauthorized access to chat' });
    }

    // Redis cache key for this page
    const cacheKey = `chat:${chatId}:messages:page:${page}:size:${pageSize}`;
    const cachedMessages = await redis.get(cacheKey);
    if (cachedMessages && cachedMessages !== "") {
      logger.info('Cache hit for messages', { chatId, page, pageSize });
      try {
        return res.status(200).json(JSON.parse(cachedMessages));
      } catch (e) {
        logger.error('Error parsing cached messages', { chatId, error: e.message });
        await redis.del(cacheKey);
      }
    }

    // Fetch from database with pagination and index usage
    const messages = await prisma.message.findMany({
      where: { chatId },
      include: {
        sender: { select: { username: true } },
      },
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: pageSize,
    });

    // Cache this page in Redis (expire after 1 hour)
    await redis.set(cacheKey, JSON.stringify(messages), { EX: 3600 });
    logger.info('Messages fetched and cached', { chatId, messageCount: messages.length, page, pageSize });

    res.status(200).json(messages);
  } catch (error) {
    logger.error('Fetch messages error', { error: error.message, chatId: req.params.chatId });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.info('Validation errors for sendMessage:', errors.array());
      return res.status(400).json({ message: 'Invalid input', errors: errors.array() });
    }

    const { chatId } = req.params;
    const { content } = req.body;
    const senderId = req.user.id;
    logger.info('Sending message', { chatId, senderId });

    // Verify user is part of the chat
    const chat = await prisma.chatSession.findUnique({
      where: { id: chatId },
      select: { initiatorId: true, recipientId: true },
    });

    if (!chat || ![chat.initiatorId, chat.recipientId].includes(senderId)) {
      logger.info('Unauthorized message send attempt', { chatId, senderId });
      return res.status(403).json({ message: 'Unauthorized access to chat' });
    }

    // Determine recipientId
    const recipientId = chat.initiatorId === senderId ? chat.recipientId : chat.initiatorId;

    // Create message
    const message = await prisma.message.create({
      data: {
        chatId,
        senderId,
        recipientId,
        content,
      },
      include: {
        sender: { select: { username: true } },
      },
    });

    // Invalidate all paginated Redis cache for this chat
    const pattern = `chat:${chatId}:messages:page:*`;
    if (typeof redis.keys === 'function') {
      // If using ioredis or node-redis with .keys support
      const keys = await redis.keys(pattern);
      if (Array.isArray(keys) && keys.length > 0) {
        await redis.del(...keys);
        logger.info('Redis paginated cache invalidated', { chatId, keys });
      }
    } else {
      // Fallback: delete first page cache only
      await redis.del(`chat:${chatId}:messages:page:1:size:20`);
      logger.info('Redis cache invalidated (fallback)', { chatId });
    }

    // Emit WebSocket event to both users
    if (req.io) {
      req.io.to(chatId).emit('newMessage', message);
      req.io.to(recipientId).emit('newMessageNotification', {
        chatId,
        message: { id: message.id, content, sender: message.sender },
      });
    }

    logger.info('Message sent', { chatId, senderId, messageId: message.id });
    res.status(201).json(message);
  } catch (error) {
    logger.error('Send message error', { error: error.message, chatId: req.params.chatId });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};