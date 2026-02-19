import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import redis from '../config/redisClient.js';

const PRESENCE_TTL = 300; // 5 minutes

interface AuthenticatedSocket extends Socket {
    userId?: string;
}

/**
 * Verify JWT token from socket handshake.
 * Sockets without a valid token are rejected immediately.
 */
function socketAuthMiddleware(socket: AuthenticatedSocket, next: (err?: Error) => void): void {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
        return next(new Error('Authentication required'));
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        return next(new Error('Server misconfigured'));
    }

    try {
        const decoded = jwt.verify(token, secret) as { id: string };
        socket.userId = decoded.id;
        next();
    } catch {
        next(new Error('Invalid token'));
    }
}

/**
 * Track user online presence in Redis.
 */
async function setOnline(userId: string): Promise<void> {
    await redis.set(`presence:${userId}`, 'online', { ex: PRESENCE_TTL });
}

async function setOffline(userId: string): Promise<void> {
    await redis.del(`presence:${userId}`);
}

async function refreshPresence(userId: string): Promise<void> {
    await redis.set(`presence:${userId}`, 'online', { ex: PRESENCE_TTL });
}

export async function isUserOnline(userId: string): Promise<boolean> {
    const status = await redis.get(`presence:${userId}`);
    return status === 'online';
}

/**
 * Register all socket event handlers.
 * Called once from server.ts with the io instance.
 */
export function registerSocketHandlers(io: Server): void {
    // Apply JWT auth middleware to every connection
    io.use((socket, next) => socketAuthMiddleware(socket as AuthenticatedSocket, next));

    io.on('connection', (rawSocket) => {
        const socket = rawSocket as AuthenticatedSocket;
        const userId = socket.userId!;

        // Auto-join the user's personal notification room
        socket.join(userId);
        setOnline(userId);

        // Broadcast online status to connected clients
        socket.broadcast.emit('userOnline', { userId });
        console.log(`[Socket] ${userId} connected (${socket.id})`);

        // --- Room Management ---
        socket.on('joinChat', (chatId: string) => {
            if (typeof chatId !== 'string' || chatId.length < 10) return;
            socket.join(chatId);
        });

        socket.on('leaveChat', (chatId: string) => {
            if (typeof chatId !== 'string' || chatId.length < 10) return;
            socket.leave(chatId);
        });

        // --- Typing Indicators ---
        socket.on('typing', (chatId: string) => {
            if (typeof chatId !== 'string') return;
            socket.to(chatId).emit('typing', { userId, chatId });
        });

        socket.on('stopTyping', (chatId: string) => {
            if (typeof chatId !== 'string') return;
            socket.to(chatId).emit('stopTyping', { userId, chatId });
        });

        // --- Heartbeat for presence ---
        socket.on('heartbeat', () => {
            refreshPresence(userId);
        });

        // --- Disconnect ---
        socket.on('disconnect', () => {
            setOffline(userId);
            socket.broadcast.emit('userOffline', { userId });
            console.log(`[Socket] ${userId} disconnected (${socket.id})`);
        });
    });
}
