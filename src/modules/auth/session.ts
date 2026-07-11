import 'server-only';

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/auth';
import { AuthenticationError, AuthorizationError } from '@/server/errors/app-error';
import { prisma } from '@/server/db/prisma';
import { canAccessAdminRoute, isPermission, type Permission, type SessionActor } from '@/server/security/permissions';

export const sessionCookie = {
  name: process.env.NODE_ENV === 'production' ? '__Secure-apple333.session' : 'apple333.session',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/'
};

export async function currentActor(): Promise<SessionActor | null> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      adminProfile: { select: { isActive: true, branchId: true } },
      roles: {
        select: {
          role: {
            select: {
              code: true,
              permissions: { select: { permission: { select: { code: true } } } }
            }
          }
        }
      }
    }
  });

  if (!user || user.status !== 'ACTIVE') {
    return null;
  }

  const permissionCodes = user.roles.flatMap((assignment) =>
    assignment.role.permissions.map((rolePermission) => rolePermission.permission.code)
  );
  const permissions = new Set<Permission>(permissionCodes.filter(isPermission));

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    ...(user.adminProfile ? { branchId: user.adminProfile.branchId } : {}),
    roleCodes: user.roles.map((assignment) => assignment.role.code),
    permissions,
    isAdmin: Boolean(user.adminProfile?.isActive)
  };
}

export async function requireActor(): Promise<SessionActor> {
  const actor = await currentActor();
  if (!actor) {
    throw new AuthenticationError();
  }
  return actor;
}

export async function requireAdminActor(): Promise<SessionActor> {
  const actor = await requireActor();
  if (!actor.isAdmin) {
    throw new AuthorizationError();
  }
  return actor;
}

export async function requireAdminPageActor(): Promise<SessionActor> {
  const actor = await currentActor();
  if (!actor) {
    redirect('/account/login?callbackUrl=/admin');
  }
  if (!actor.isAdmin) {
    redirect('/account/login?error=AccessDenied');
  }
  return actor;
}

export async function requireAdminPagePermission(permission: Permission): Promise<SessionActor> {
  const actor = await requireAdminPageActor();
  if (!canAccessAdminRoute(actor, permission)) {
    redirect('/admin/access-denied');
  }
  return actor;
}
