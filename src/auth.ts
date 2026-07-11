import { PrismaAdapter } from '@auth/prisma-adapter';
import { compare } from 'bcryptjs';
import type { Adapter } from 'next-auth/adapters';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { z } from 'zod';

import { prisma } from '@/server/db/prisma';

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128)
});

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  ...(authSecret ? { secret: authSecret } : {}),
  session: {
    strategy: 'database',
    maxAge: 60 * 60 * 8,
    updateAge: 60 * 30
  },
  pages: {
    signIn: '/account/login'
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-apple333.session' : 'apple333.session',
      options: {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      }
    }
  },
  providers: [
    CredentialsProvider({
      name: 'Admin credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          include: { adminProfile: true }
        });

        if (
          !user ||
          user.status !== 'ACTIVE' ||
          !user.adminProfile?.isActive ||
          !user.adminProfile.passwordHash
        ) {
          return null;
        }

        const passwordMatches = await compare(parsed.data.password, user.adminProfile.passwordHash);
        if (!passwordMatches) {
          return null;
        }

        await prisma.adminUser.update({
          where: { id: user.adminProfile.id },
          data: { lastLoginAt: new Date() }
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image
        };
      }
    })
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    }
  }
};
