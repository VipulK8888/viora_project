import { PrismaClient, Prisma } from '../generated/prisma-client';
export { Prisma };
import { env } from './env';

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Health-check helper to verify database connectivity without crashing
 */
export async function checkDatabaseConnection(): Promise<{ isConnected: boolean; message: string }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { isConnected: true, message: 'Database connection active' };
  } catch (err: any) {
    return {
      isConnected: false,
      message: `Database standby (Phase 2): ${err.message || 'PostgreSQL not yet provisioned'}`,
    };
  }
}
