import  express  from  'express';
import  {
  initiateChat,
  getChats,
  getMessages,
  sendMessage,
  validateChatInitiation,
  validateMessage,
 } from '../controllers/chatController';
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', validateChatInitiation, authMiddleware, initiateChat);
router.get('/:userId', authMiddleware, getChats);
router.get('/:chatId/messages', validateMessage, authMiddleware, getMessages);
router.post('/:chatId/messages', validateMessage, authMiddleware, sendMessage);

module.exports = router;