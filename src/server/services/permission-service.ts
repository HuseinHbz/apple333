import { toPermissionDto } from '@/server/admin/mappers';
import type { AdminPermissionDto } from '@/server/admin/types';
import { permissionRepository } from '@/server/repositories/permission-repository';

export async function listAdminPermissions(): Promise<
  readonly AdminPermissionDto[]
> {
  return (await permissionRepository.list()).map(toPermissionDto);
}
