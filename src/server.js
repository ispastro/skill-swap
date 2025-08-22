import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import prisma from './config/db.js';
import redis from './config/redisClient.js'; // Ensure this is correctly set up
import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import matchRoutes from './routes/matchRoutes.js';
import barterRoutes from './routes/barterRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import googleAuthRoutes from './routes/googleAuthRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { notifyNewMatches } from './controllers/notifyController.js';
import authMiddleware from './middleware/authMiddleware.js';
import passport from 'passport';
import reviewRoutes from './routes/reviewRoutes.js'; // Import review routes
import fileRoutes from './routes/fileRoutes.js'; // Import file sharing routes

// Load environment variables
dotenv.config();

// Initialize Express app and HTTP server
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json( { limit: '50mb' })); // Increased limit for file uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Increased limit for file uploads
app.use(passport.initialize());
//app.use(passport.session());
// Attach io to requests for WebSocket events
app.use((req, res, next) => {
  req.io = io;
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', authMiddleware, profileRoutes);
app.use('/api/match', authMiddleware, matchRoutes);
app.use('/api/barter', authMiddleware, barterRoutes);
app.use('/api/chats', authMiddleware, chatRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);
app.use('/auth', googleAuthRoutes);
app.use('/api/reviews',  reviewRoutes);

// File sharing routes
app.use('/api/files', authMiddleware, fileRoutes);

// Root health check route
app.get('/', (req, res) => {
  res.send('SkillSwap API is running 🚀');
});

// WebSocket setup
io.on('connection', (socket) => {
  // Auto-join user room on connect if userId is in handshake query
  const userId = socket.handshake.query.userId;
  if (userId) {
    socket.join(userId);
    console.log(`Socket ${socket.id} auto-joined user room ${userId} on connect`);
  }

  // Allow explicit join (for legacy or fallback)
  socket.on('join', (id) => {
    socket.join(id);
    console.log(`Socket ${socket.id} joined room ${id}`);
  });

  // Join chat room for group chat/message delivery
  socket.on('joinChat', (chatId) => {
    socket.join(chatId);
    console.log(`Socket ${socket.id} joined chat room: ${chatId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// redis set up
app.get('/set', async (req, res) => {
  await redis.set('greeting', 'Hello from Redis!');
  res.send('Key set!');
});

app.get('/get', async (req, res) => {
  const value = await redis.get('greeting');
  res.send(`Value: ${value}`);
});



// Start Server
const PORT = process.env.PORT || 8000;

const startServer = async () => {
  try {
    // Ensure Prisma can connect to the DB
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

startServer();