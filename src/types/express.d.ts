import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        iat?: number;
        exp?: number;
      };
      io?: any; // Socket.IO instance (will type properly later)
      updatedUser?: any; // For profile update flow (will type properly later)
    }
  }
}

export {};
