import type { Prisma, PrismaClient } from '@prisma/client';

export type AdminDatabaseClient = PrismaClient | Prisma.TransactionClient;
