import express from 'express';

import {login , register} from '../controllers/authController.js';
import { getUserProfile } from '../controllers/profileController.js';

const router =express.Router();

router.post('/login', login);
router.post('/register', register);
router.get('/profile', getUserProfile); // Assuming you want to add this route

export default router;