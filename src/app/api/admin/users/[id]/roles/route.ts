import { z } from 'zod';

import { assignAdminUserRoleInput } from '@/modules/admin/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { assignAdminUserRole } from '@/server/services/admin-user-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute({
    permission: 'users.update',
    mutation: true,
    parse: async (incoming) => {
      const body = await jsonBody(z.record(z.unknown()))(incoming);
      return assignAdminUserRoleInput.parse({ ...body, userId: id });
    },
    handler: ({ actor, input, audit }) => assignAdminUserRole(input, audit, actor.permissions)
  })(request);
}
