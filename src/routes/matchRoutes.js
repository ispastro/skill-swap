

import express from 'express';


import {findSkillsMatches} from '../controllers/matchController.js';
import {notifyNewMatches} from '../controllers/notifyController.js';

import authMiddleware from '../middleware/authMiddleware.js';


const router = express.Router();

router.get('/matches', authMiddleware, findSkillsMatches);
router.post('/notify-matches',authMiddleware,  notifyNewMatches);



export default router;


