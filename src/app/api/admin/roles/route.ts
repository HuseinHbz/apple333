import { createRoleInput, type CreateRoleInput } from '@/modules/roles/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { createAdminRole, listAdminRoles } from '@/server/services/role-service';

export const GET = withAdminRoute({
  permission: 'roles.read',
  handler: () => listAdminRoles()
});

export const POST = withAdminRoute<CreateRoleInput>({
  permission: 'roles.create',
  mutation: true,
  status: 201,
  parse: jsonBody(createRoleInput),
  handler: ({ actor, input, audit }) => createAdminRole(input, audit, actor.permissions)
});
