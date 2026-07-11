import type { ReactNode } from 'react';
import { requireAdminPagePermission } from '@/modules/auth/session';
import type { Permission } from '@/server/security/permissions';

interface AdminPermissionGuardProps {
  permission: Permission;
  children: ReactNode;
}

/**
 * A server-side guard for page modules. The shell only controls navigation;
 * this guard prevents a user from gaining access by typing a protected URL.
 */
export async function AdminPermissionGuard({ permission, children }: AdminPermissionGuardProps) {
  await requireAdminPagePermission(permission);
  return <>{children}</>;
}
