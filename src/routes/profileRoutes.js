
import express from 'express';
import { getUserProfile, updateUserProfile } from '../controllers/profileController.js';
import authMiddleware from '../middleware/authMiddleware.js';


const router = express.Router();

router.get('/', authMiddleware, getUserProfile);
router.put('/', authMiddleware, updateUserProfile);

export default router;