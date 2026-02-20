import jwt from 'jsonwebtoken';
import passport from '../config/passport.js';
import express, { Router, Request, Response } from 'express';

const router: Router = express.Router();

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/' }),
    (req: Request, res: Response): void => {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            res.status(500).json({ message: 'JWT_SECRET not configured' });
            return;
        }
        const user = req.user as { id: string };
        const token = jwt.sign({ id: user.id }, secret, { expiresIn: '3d' });
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    }
);

export default router;
