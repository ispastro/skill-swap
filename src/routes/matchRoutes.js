

import express from 'express';


import {findSkillsMatches, verifySkill} from '../controllers/matchController.js';


import authMiddleware from '../middleware/authMiddleware.js';


const router = express.Router();

router.get('/matches', findSkillsMatches);
router.post('/verify-skill', verifySkill);

export default router;


