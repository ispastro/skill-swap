import express, { Router } from 'express';
import { findSkillsMatches, verifySkill } from '../controllers/matchController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router: Router = express.Router();

router.get('/matches', authMiddleware, findSkillsMatches);
router.post('/verify-skill', authMiddleware, verifySkill);

export default router;
