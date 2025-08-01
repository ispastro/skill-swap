import  express  from  'express';
import  {
  initiateChat,
  getChats,
  getMessages,
  sendMessage,
  validateChatInitiation,
  validateMessage,
 } from '../controllers/chatController.js';
import authMiddleware from '../middleware/authMiddleware.js'; 

const router = express.Router();

router.post('/', validateChatInitiation, authMiddleware, initiateChat);
router.get('/:userId', authMiddleware, getChats);
router.get('/:chatId/messages', validateMessage, authMiddleware, getMessages);
router.post('/:chatId/messages', validateMessage, authMiddleware, sendMessage);
export default router;