import express from 'express';
import { body } from 'express-validator';
import { sendNotification, notifyNewMatches } from '../controllers/notifyController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.post(
  '/',
  authMiddleware,
  [
    body('recipientId').isUUID().withMessage('Invalid recipient ID'),
    body('message').isString().isLength({ max: 255 }).withMessage('Message must be a string, max 255 characters'),
  ],
  sendNotification
);

router.post('/new-matches', authMiddleware, notifyNewMatches);

export default router;

