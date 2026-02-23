import express, { Router } from 'express';
import { getUserProfile, updateUserProfile } from '../controllers/profileController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { updateProfileValidator } from '../validators/profileValidators.js';
import { validateResult } from '../middleware/validateRequest.js';

const router: Router = express.Router();

router.get('/', authMiddleware, getUserProfile);
router.put('/', authMiddleware, updateProfileValidator, validateResult, updateUserProfile);

export default router;
