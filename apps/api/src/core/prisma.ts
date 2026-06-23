import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

function createPrismaClient() {
  return new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

prisma.$on('error', e => logger.error({ msg: e.message }, 'Prisma error'));
prisma.$on('warn', e => logger.warn({ msg: e.message }, 'Prisma warning'));

export default prisma;
