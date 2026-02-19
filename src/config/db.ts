import { PrismaClient } from '@prisma/client';

// Prevent multiple PrismaClient instances during tsx watch hot-reloads in development.
// In production, module cache is stable so this is a no-op.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

export default prisma;
