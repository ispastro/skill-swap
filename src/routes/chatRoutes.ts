import express, { Router } from 'express';
import {
  initiateChat,
  getChats,
  getMessages,
  sendMessage,
  getChatSession,
  markMessagesRead
} from '../controllers/chatController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { initiateChatValidator, sendMessageValidator, getChatMessagesValidator } from '../validators/chatValidators.js';
import { validateResult } from '../middleware/validateRequest.js';
import { chatLimiter } from '../middleware/rateLimiter.js';
import { isUserOnline } from '../sockets/socketHandler.js';

const router: Router = express.Router();

// IMPORTANT: /session MUST come before /:param routes
router.get('/session', authMiddleware, getChatSession);

// Check if a user is online
router.get('/presence/:userId', authMiddleware, async (req, res) => {
  const online = await isUserOnline(req.params.userId as string);
  res.json({ userId: req.params.userId, online });
});

router.post('/', authMiddleware, initiateChatValidator, validateResult, initiateChat);
router.get('/:userId', authMiddleware, getChats);
router.get('/:chatId/messages', authMiddleware, getChatMessagesValidator, validateResult, getMessages);
router.post('/:chatId/messages', authMiddleware, chatLimiter, sendMessageValidator, validateResult, sendMessage);

// Mark messages as read
router.patch('/:chatId/read', authMiddleware, getChatMessagesValidator, validateResult, markMessagesRead);

export default router;
