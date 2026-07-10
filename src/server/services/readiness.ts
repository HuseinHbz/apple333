import { readServerEnv } from '@/config/env';
import { prisma } from '@/server/db/prisma';
export async function readiness(){try{const env=readServerEnv();await prisma.$queryRaw`SELECT 1`;return {ready:true,checks:{configuration:'ok',database:'ok',redis:env.REDIS_URL?'not-configured-adapter':'disabled'}};}catch{return {ready:false,checks:{configuration:'unavailable',database:'unavailable',redis:'unknown'}};}}
