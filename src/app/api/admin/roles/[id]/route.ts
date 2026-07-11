import { z } from 'zod';

import { updateRoleInput } from '@/modules/roles/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { deleteAdminRole, getAdminRole, updateAdminRole } from '@/server/services/role-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute({
    permission: 'roles.read',
    parse: async () => z.string().cuid().parse(id),
    handler: ({ input }) => getAdminRole(input)
  })(request);
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute({
    permission: 'roles.update',
    mutation: true,
    parse: async (incoming) => ({
      roleId: z.string().cuid().parse(id),
      input: await jsonBody(updateRoleInput)(incoming)
    }),
    handler: ({ input, audit }) => updateAdminRole(input.roleId, input.input, audit)
  })(request);
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute({
    permission: 'roles.delete',
    mutation: true,
    parse: async () => z.string().cuid().parse(id),
    handler: async ({ input, audit }) => {
      await deleteAdminRole(input, audit);
      return { deleted: true };
    }
  })(request);
}
