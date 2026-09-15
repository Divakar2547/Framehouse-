import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: env.isDevelopment ? ['query', 'error', 'warn'] : ['error'],
  });

if (env.isDevelopment) {
  globalThis.__prisma = prisma;
}

export default prisma;
