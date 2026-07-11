import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from '@/server/errors/app-error';
import { auditInput, requireAuditContext } from '@/server/admin/audit';
import { ProtectedSystemRoleError } from '@/server/admin/errors';
import { toRoleDto } from '@/server/admin/mappers';
import type { AdminAuditContext, AdminRoleDto } from '@/server/admin/types';
import type {
  CreateRoleInput,
  ReplaceRolePermissionsInput,
  UpdateRoleInput,
} from '@/modules/roles/validators';
import { prisma } from '@/server/db/prisma';
import { auditLogRepository } from '@/server/repositories/audit-log-repository';
import { permissionRepository } from '@/server/repositories/permission-repository';
import { roleRepository } from '@/server/repositories/role-repository';
import { SYSTEM_ROLES } from '@/modules/auth/default-rbac';

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

const reservedSystemRoleCodes = new Set(SYSTEM_ROLES.map((role) => role.code));

export function assertPermissionDelegation(
  requestedPermissionCodes: readonly string[],
  actorPermissions: ReadonlySet<string>,
): void {
  if (requestedPermissionCodes.some((code) => !actorPermissions.has(code))) {
    throw new AuthorizationError();
  }
}

function assertCustomRoleCode(code: string): void {
  if (reservedSystemRoleCodes.has(code)) {
    throw new ValidationError({ code: 'System role codes are reserved.' });
  }
}

async function assertPermissionsExist(
  permissionIds: readonly string[],
  actorPermissions: ReadonlySet<string>,
  transaction: Parameters<typeof permissionRepository.findByIds>[1],
): Promise<string[]> {
  const uniquePermissionIds = uniqueIds(permissionIds);
  if (uniquePermissionIds.length === 0) {
    return uniquePermissionIds;
  }

  const permissions = await permissionRepository.findByIds(
    uniquePermissionIds,
    transaction,
  );
  if (permissions.length !== uniquePermissionIds.length) {
    throw new NotFoundError();
  }
  assertPermissionDelegation(permissions.map((permission) => permission.code), actorPermissions);

  return uniquePermissionIds;
}

export function assertRoleIsMutable(isSystem: boolean): void {
  if (isSystem) {
    throw new ProtectedSystemRoleError();
  }
}

export async function listAdminRoles(): Promise<readonly AdminRoleDto[]> {
  return (await roleRepository.list()).map(toRoleDto);
}

export async function getAdminRole(roleId: string): Promise<AdminRoleDto> {
  const role = await roleRepository.findById(roleId);
  if (role === null) {
    throw new NotFoundError();
  }

  return toRoleDto(role);
}

export async function createAdminRole(
  input: CreateRoleInput,
  context: AdminAuditContext,
  actorPermissions: ReadonlySet<string>,
): Promise<AdminRoleDto> {
  const auditContext = requireAuditContext(context);

  return prisma.$transaction(async (transaction) => {
    assertCustomRoleCode(input.code);
    const existing = await roleRepository.findByCode(input.code, transaction);
    if (existing !== null) {
      throw new ConflictError();
    }

    const permissionIds = await assertPermissionsExist(
      input.permissionIds,
      actorPermissions,
      transaction,
    );
    const created = await roleRepository.create(
      {
        code: input.code,
        name: input.name,
        ...(input.description === undefined
          ? {}
          : { description: input.description }),
      },
      transaction,
    );
    const role = await roleRepository.replacePermissions(
      created.id,
      permissionIds,
      transaction,
    );
    await auditLogRepository.create(
      auditInput(auditContext, {
        action: 'admin.role.created',
        entityType: 'Role',
        entityId: role.id,
        metadata: { roleCode: role.code, permissionCount: permissionIds.length },
      }),
      transaction,
    );

    return toRoleDto(role);
  });
}

export async function updateAdminRole(
  roleId: string,
  input: UpdateRoleInput,
  context: AdminAuditContext,
): Promise<AdminRoleDto> {
  const auditContext = requireAuditContext(context);

  return prisma.$transaction(async (transaction) => {
    const role = await roleRepository.findById(roleId, transaction);
    if (role === null) {
      throw new NotFoundError();
    }
    assertRoleIsMutable(role.isSystem);

    const updated = await roleRepository.update(roleId, input, transaction);
    await auditLogRepository.create(
      auditInput(auditContext, {
        action: 'admin.role.updated',
        entityType: 'Role',
        entityId: roleId,
        metadata: { roleCode: updated.code },
      }),
      transaction,
    );

    return toRoleDto(updated);
  });
}

export async function replaceAdminRolePermissions(
  roleId: string,
  input: ReplaceRolePermissionsInput,
  context: AdminAuditContext,
  actorPermissions: ReadonlySet<string>,
): Promise<AdminRoleDto> {
  const auditContext = requireAuditContext(context);

  return prisma.$transaction(async (transaction) => {
    const role = await roleRepository.findById(roleId, transaction);
    if (role === null) {
      throw new NotFoundError();
    }
    assertRoleIsMutable(role.isSystem);

    const permissionIds = await assertPermissionsExist(
      input.permissionIds,
      actorPermissions,
      transaction,
    );
    const updated = await roleRepository.replacePermissions(
      roleId,
      permissionIds,
      transaction,
    );
    await auditLogRepository.create(
      auditInput(auditContext, {
        action: 'admin.role.permissions.replaced',
        entityType: 'Role',
        entityId: roleId,
        metadata: { roleCode: updated.code, permissionCount: permissionIds.length },
      }),
      transaction,
    );

    return toRoleDto(updated);
  });
}

export async function deleteAdminRole(
  roleId: string,
  context: AdminAuditContext,
): Promise<void> {
  const auditContext = requireAuditContext(context);

  await prisma.$transaction(async (transaction) => {
    const role = await roleRepository.findById(roleId, transaction);
    if (role === null) {
      throw new NotFoundError();
    }
    assertRoleIsMutable(role.isSystem);
    if ((await roleRepository.countAssignedUsers(roleId, transaction)) > 0) {
      throw new ConflictError();
    }

    await roleRepository.delete(roleId, transaction);
    await auditLogRepository.create(
      auditInput(auditContext, {
        action: 'admin.role.deleted',
        entityType: 'Role',
        entityId: roleId,
        metadata: { roleCode: role.code },
      }),
      transaction,
    );
  });
}
