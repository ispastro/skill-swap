import express from 'express';

import {login , register} from '../controllers/authController.js';
import { registerValidator, loginValidator } from '../validators/authValidators.js';
import { validateResult } from '../middleware/validateRequest.js';


const router =express.Router();

router.post('/login', loginValidator, validateResult, login);
router.post('/register', registerValidator, validateResult, register);
// Assuming you want to add this route

export default router;