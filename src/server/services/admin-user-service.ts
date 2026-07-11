import { ConflictError, NotFoundError } from '@/server/errors/app-error';
import { auditInput, requireAuditContext } from '@/server/admin/audit';
import {
  toAdminUserDetailDto,
  toAdminUserListItemDto,
} from '@/server/admin/mappers';
import { toPage } from '@/server/admin/pagination';
import type {
  AdminAuditContext,
  AdminUserDetailDto,
  AdminUserListItemDto,
  Page,
} from '@/server/admin/types';
import {
  adminUserRepository,
} from '@/server/repositories/admin-user-repository';
import { auditLogRepository } from '@/server/repositories/audit-log-repository';
import { roleRepository } from '@/server/repositories/role-repository';
import { assertPermissionDelegation } from '@/server/services/role-service';
import { prisma } from '@/server/db/prisma';
import type {
  AdminUserListQuery,
  AssignAdminUserRoleInput,
  UpdateAdminUserStatusInput,
} from '@/modules/admin/validators';

export async function listAdminUsers(
  query: AdminUserListQuery,
): Promise<Page<AdminUserListItemDto>> {
  const result = await adminUserRepository.findPage({
    page: query.page,
    pageSize: query.pageSize,
    ...(query.query === undefined ? {} : { query: query.query }),
    ...(query.status === undefined ? {} : { status: query.status }),
  });

  return toPage(
    result.items.map(toAdminUserListItemDto),
    query,
    result.total,
  );
}

export async function getAdminUser(
  userId: string,
): Promise<AdminUserDetailDto> {
  const user = await adminUserRepository.findDetailById(userId);
  if (user === null) {
    throw new NotFoundError();
  }

  return toAdminUserDetailDto(user);
}

export async function updateAdminUserStatus(
  input: UpdateAdminUserStatusInput,
  context: AdminAuditContext,
): Promise<AdminUserDetailDto> {
  const auditContext = requireAuditContext(context);

  return prisma.$transaction(async (transaction) => {
    const existing = await adminUserRepository.findDetailById(
      input.userId,
      transaction,
    );
    if (existing === null) {
      throw new NotFoundError();
    }

    if (auditContext.actorId === input.userId && input.status !== 'ACTIVE') {
      throw new ConflictError();
    }

    const user = await adminUserRepository.updateStatus(
      input.userId,
      input.status,
      transaction,
    );
    await auditLogRepository.create(
      auditInput(auditContext, {
        action: 'admin.user.status.updated',
        entityType: 'User',
        entityId: user.id,
        metadata: { previousStatus: existing.status, nextStatus: user.status },
      }),
      transaction,
    );

    return toAdminUserDetailDto(user);
  });
}

export async function assignAdminUserRole(
  input: AssignAdminUserRoleInput,
  context: AdminAuditContext,
  actorPermissions: ReadonlySet<string>,
): Promise<AdminUserDetailDto> {
  const auditContext = requireAuditContext(context);

  return prisma.$transaction(async (transaction) => {
    const [user, role] = await Promise.all([
      adminUserRepository.findDetailById(input.userId, transaction),
      roleRepository.findById(input.roleId, transaction),
    ]);
    if (user === null || role === null) {
      throw new NotFoundError();
    }
    assertPermissionDelegation(
      role.permissions.map((assignment) => assignment.permission.code),
      actorPermissions,
    );

    await adminUserRepository.assignRole(input.userId, input.roleId, transaction);
    const updatedUser = await adminUserRepository.findDetailById(
      input.userId,
      transaction,
    );
    if (updatedUser === null) {
      throw new NotFoundError();
    }

    await auditLogRepository.create(
      auditInput(auditContext, {
        action: 'admin.user.role.assigned',
        entityType: 'User',
        entityId: input.userId,
        metadata: { roleId: role.id, roleCode: role.code },
      }),
      transaction,
    );

    return toAdminUserDetailDto(updatedUser);
  });
}
