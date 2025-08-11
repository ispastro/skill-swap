import  express from 'express';
import { getUserProfile, updateUserProfile } from  '../controllers/profileController.js';
import  { notifyNewMatches }  from '../controllers/notifyController.js';
import  authMiddleware  from  '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', authMiddleware, getUserProfile);
router.put('/:userId', authMiddleware, updateUserProfile, notifyNewMatches);

export default router;

