import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import prisma from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import matchRoutes from './routes/matchRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import googleAuthRoutes from './routes/googleAuthRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import passport from 'passport';
import reviewRoutes from './routes/reviewRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { registerSocketHandlers } from './sockets/socketHandler.js';

// Load environment variables
dotenv.config();

// Initialize Express app and HTTP server
const app = express();
const httpServer = createServer(app);
const ALLOWED_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:5173';
const io = new Server(httpServer, {
    cors: { origin: ALLOWED_ORIGIN, methods: ['GET', 'POST'] },
    pingTimeout: 30000,
    pingInterval: 15000,
});

// Security middleware
app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(passport.initialize());

// Global rate limiter
app.use('/api/', apiLimiter);

// Attach io to requests for WebSocket events
app.use((req: Request, _res: Response, next: NextFunction) => {
    req.io = io;
    next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/auth', googleAuthRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/files', fileRoutes);

// Root health check route
app.get('/', (_req: Request, res: Response) => {
    res.send('SkillSwap API is running 🚀');
});

// Global error handler
app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(err.status || 500).json({
        message: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message || 'Internal server error',
    });
});

// Register Socket.IO handlers — JWT auth, typing, presence, room management
registerSocketHandlers(io);

// Start Server
const PORT = process.env.PORT || 8000;

const startServer = async (): Promise<void> => {
    try {
        await prisma.$connect();
        console.log('📦 Connected to the database successfully');

        httpServer.listen(PORT, () => {
            console.log(`⚡ Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Failed to connect to the database', error);
        process.exit(1);
    }
};

// Graceful shutdown
const shutdown = async (): Promise<void> => {
    console.log('\n🛑 Shutting down gracefully...');
    io.close();
    await prisma.$disconnect();
    httpServer.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startServer();
