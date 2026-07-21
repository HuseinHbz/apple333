import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  console.error('Database connectivity check failed: DATABASE_URL is not available to the process.');
  process.exitCode = 1;
} else {
  const prisma = new PrismaClient();

  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    console.log('Database connectivity verified.');
  } catch {
    // Do not print a driver error: it can include a connection string or
    // topology details. The protected environment checker reports safe next
    // actions to the operator instead.
    console.error('Database connectivity check failed. Verify protected environment and PostgreSQL reachability.');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
