import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import {Server} from 'socket.io';

import prisma from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import matchRoutes from './routes/matchRoutes.js';
import barterRoutes from './routes/barterRoutes.js';
import {createServer} from  'http';


// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();


// Middleware
app.use(cors({
  origin: '*',
}));
app.use(express.json());

// Create HTTP server for Socket.IO
const httpServer = createServer(app);
// Initialize Socket.IO
const io = new Server(httpServer, {
  cors:{
    origin: '*',
    methods: ['GET', 'POST'],

  }
});


// Socket.IO connection
io.on('connection', (socket)=>{
  console.log(`user is connected ${socket.id}`)
});
//Socket.IO disconnect 

io.on('disconnect', (socket)=>{
  console.log(`user is disconnected ${socket.id}`)
})




// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/barter', barterRoutes);
// Root health check route (optional but handy)
app.get('/', (req, res) => {
  res.send('SkillSwap API is running 🚀');
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
    process.exit(1); // Exit if DB connection fails
  }
};

startServer();

