

import express from 'express';


import {findSkillsMatches} from '../controllers/matchController.js';

import authMiddleware from '../middleware/authMiddleware.js';


const router = express.Router();

router.get('/', authMiddleware, findSkillsMatches);


export default router;
