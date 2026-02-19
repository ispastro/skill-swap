import express, { Router } from 'express';
import { getUserProfile, updateUserProfile } from '../controllers/profileController.js';
// @ts-ignore
import { notifyNewMatches } from '../controllers/notifyController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router: Router = express.Router();

router.get('/', authMiddleware, getUserProfile);
router.put('/', authMiddleware, updateUserProfile, notifyNewMatches);

export default router;

