import { z } from 'zod';

import { withAdminRoute } from '@/server/admin/route';
import { markAdminNotificationRead } from '@/server/services/notification-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute({
    permission: 'notifications.update',
    mutation: true,
    parse: async () => z.string().cuid().parse(id),
    handler: ({ input, audit }) => markAdminNotificationRead(input, audit)
  })(request);
}
