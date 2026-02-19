import express, { Router } from 'express';
import { login, register } from '../controllers/authController.js';
import { registerValidator, loginValidator } from '../validators/authValidators.js';
import { validateResult } from '../middleware/validateRequest.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router: Router = express.Router();

router.post('/login', authLimiter, loginValidator, validateResult, login);
router.post('/register', authLimiter, registerValidator, validateResult, register);

export default router;
