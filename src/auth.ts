import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import type { Adapter } from "next-auth/adapters";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";

import { isPaymentSimulatorRuntimeAllowed } from "@/modules/payments/runtime-policy";
import { prisma } from "@/server/db/prisma";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
});

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

/**
 * Production sessions always use Secure cookies. The lone exception is the
 * explicitly guarded, loopback-only standalone E2E runtime: it must use HTTP
 * so Playwright can verify the production artifact without a real certificate.
 * Both the runtime-evidence marker and an owned disposable-database marker are
 * required, so an ordinary production host cannot opt out accidentally.
 */
const isGuardedPaymentE2eRuntime =
  process.env.APPLE333_PAYMENT_E2E_TEST_DB === "1" &&
  isPaymentSimulatorRuntimeAllowed();
const isGuardedLoopbackE2eRuntime =
  process.env.APPLE333_E2E_RUNTIME_EVIDENCE === "1" &&
  (process.env.APPLE333_E2E_TEST_DB === "1" ||
    process.env.APPLE333_ORDER_E2E_TEST_DB === "1" ||
    isGuardedPaymentE2eRuntime);

export const usesSecureSessionCookie =
  process.env.NODE_ENV === "production" && !isGuardedLoopbackE2eRuntime;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  ...(authSecret ? { secret: authSecret } : {}),
  session: {
    // NextAuth's Credentials provider can only establish JWT sessions. The
    // Prisma adapter remains available for the shared user model, but a
    // database session strategy would make every credential sign-in fail.
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
    updateAge: 60 * 30,
  },
  pages: {
    signIn: "/account/login",
  },
  cookies: {
    sessionToken: {
      name: usesSecureSessionCookie
        ? "__Secure-apple333.session"
        : "apple333.session",
      options: {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: usesSecureSessionCookie,
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: "Apple333 credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          include: { adminProfile: true, profile: true },
        });

        if (!user || user.status !== "ACTIVE") {
          return null;
        }

        // Administrative accounts retain their dedicated profile and are
        // disabled when that profile is inactive. Customer accounts use only
        // the customer profile credential; neither type can borrow the other
        // account's authority after sign-in.
        const passwordHash = user.adminProfile?.isActive
          ? user.adminProfile.passwordHash
          : user.profile?.passwordHash;
        if (!passwordHash) return null;

        const passwordMatches = await compare(
          parsed.data.password,
          passwordHash,
        );
        if (!passwordMatches) {
          return null;
        }

        if (user.adminProfile?.isActive) {
          await prisma.adminUser.update({
            where: { id: user.adminProfile.id },
            data: { lastLoginAt: new Date() },
          });
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};
