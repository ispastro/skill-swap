 import jwt from 'jsonwebtoken';
 import passport from '../config/passport.js';
 import express from 'express';

 const router = express.Router();

 router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

 router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/' }),
    (req, res)=>{
        const token = jwt.sign({ id: req.user.id}, process.env.JWT_SECRET, { expiresIn: '3d' });
       // After successful Google OAuth
// Instead of: res.json({ token });
res.redirect(`http://localhost:5173/auth/callback?token=${token}`);
    }
 );
 export default router;