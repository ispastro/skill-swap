import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';

const SALT_ROUNDS = 12;

function signToken(userId: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');
    return jwt.sign({ id: userId }, secret, { expiresIn: '3d' });
}

export const register = async (req: Request, res: Response): Promise<Response> => {
    const { name, email, password } = req.body;

    try {
        const exists = await prisma.user.findUnique({ where: { email } });
        if (exists) {
            return res.status(409).json({ message: 'User already exists' });
        }

        const hash = await bcrypt.hash(password, SALT_ROUNDS);

        const user = await prisma.user.create({
            data: { name, email, password: hash },
        });

        const token = signToken(user.id);
        return res.status(201).json({ token });
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

export const login = async (req: Request, res: Response): Promise<Response> => {
    const { email, password } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = signToken(user.id);
        return res.status(200).json({ token });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};
