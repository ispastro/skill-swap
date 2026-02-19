import { Server } from 'socket.io';
import { User as PrismaUser } from '@prisma/client';

declare global {
  namespace Express {
    interface User {
      id: string;
      iat?: number;
      exp?: number;
    }

    interface Request {
      io?: Server;
      updatedUser?: Pick<PrismaUser, 'id' | 'name' | 'bio' | 'skillsHave' | 'skillsWant'>;
    }
  }
}

export { };
