import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import prisma from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import matchRoutes from './routes/matchRoutes.js';
import barterRoutes from './routes/barterRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import { notifyNewMatches } from './controllers/notifyController.js';

// Load environment variables
dotenv.config();

// Initialize Express app and HTTP server
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: 'http://localhost:5174', methods: ['GET', 'POST'] },
});

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Attach io to requests for WebSocket events
app.use((req, res, next) => {
  req.io = io;
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/barter', barterRoutes);
app.use('/api/chats', chatRoutes);

// Root health check route
app.get('/', (req, res) => {
  res.send('SkillSwap API is running 🚀');
});

// WebSocket setup
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
  });
  socket.on('joinChat', (chatId) => {
    socket.join(chatId);
    console.log(`User joined chat room: ${chatId}`);
  });
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
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