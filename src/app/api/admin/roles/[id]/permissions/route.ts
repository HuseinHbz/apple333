import { z } from 'zod';

import { replaceRolePermissionsInput } from '@/modules/roles/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { replaceAdminRolePermissions } from '@/server/services/role-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute({
    permission: 'roles.update',
    mutation: true,
    parse: async (incoming) => ({
      roleId: z.string().cuid().parse(id),
      input: await jsonBody(replaceRolePermissionsInput)(incoming)
    }),
    handler: ({ actor, input, audit }) => replaceAdminRolePermissions(input.roleId, input.input, audit, actor.permissions)
  })(request);
}
