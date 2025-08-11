import  express  from  'express';
import  {
  initiateChat,
  getChats,
  getMessages,
  sendMessage,
  validateChatId,
  validateChatInitiation,
  validateMessage,
 } from '../controllers/chatController.js';
import authMiddleware from '../middleware/authMiddleware.js'; 

const router = express.Router();

router.post('/', validateChatInitiation, authMiddleware, initiateChat);
router.get('/:userId', authMiddleware, getChats);
router.get('/:chatId/messages', authMiddleware, validateChatId, getMessages);
router.post('/:chatId/messages', authMiddleware, validateMessage, sendMessage);
export default router;


