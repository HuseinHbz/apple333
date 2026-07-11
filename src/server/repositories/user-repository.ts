import { prisma } from '@/server/db/prisma';

export const userRepository = {
  findSafeProfileById: (id: string) => prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      mobile: true,
      status: true,
      profile: { select: { firstName: true, lastName: true } }
    }
  }),
  list: (skip: number, take: number) => prisma.user.findMany({
    skip,
    take,
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, mobile: true, status: true, createdAt: true }
  })
};
