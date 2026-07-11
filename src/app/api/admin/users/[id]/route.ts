import { z } from 'zod';

import { updateAdminUserStatusInput } from '@/modules/admin/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { getAdminUser, updateAdminUserStatus } from '@/server/services/admin-user-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute({
    permission: 'users.read',
    parse: async () => z.string().cuid().parse(id),
    handler: ({ input }) => getAdminUser(input)
  })(request);
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute({
    permission: 'users.update',
    mutation: true,
    parse: async (incoming) => {
      const body = await jsonBody(z.record(z.unknown()))(incoming);
      return updateAdminUserStatusInput.parse({ ...body, userId: id });
    },
    handler: ({ input, audit }) => updateAdminUserStatus(input, audit)
  })(request);
}
