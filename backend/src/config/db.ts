import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: ['error', 'warn']
});

export async function connectDB() {
  try {
    await prisma.$connect();
    console.log('✅ Connected to MySQL database via Prisma');
  } catch (error) {
    console.error('❌ Failed to connect to MySQL database:', error);
  }
}
