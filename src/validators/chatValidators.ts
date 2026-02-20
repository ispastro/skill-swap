import { body, param } from 'express-validator';

export const initiateChatValidator = [
  body('recipientId')
    .isUUID()
    .withMessage('Invalid recipient ID format'),
];

export const sendMessageValidator = [
  param('chatId')
    .isUUID()
    .withMessage('Invalid chat ID format'),
  
  body('content')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Message content is required')
    .isLength({ max: 1000 })
    .withMessage('Message must be 1000 characters or less'),
];

export const getChatMessagesValidator = [
  param('chatId')
    .isUUID()
    .withMessage('Invalid chat ID format'),
];
