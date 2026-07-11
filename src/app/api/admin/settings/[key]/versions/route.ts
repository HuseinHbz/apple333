import { z } from 'zod';

import { withAdminRoute } from '@/server/admin/route';
import { listAdminSettingVersions } from '@/server/services/setting-service';

const settingKey = z.string().trim().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/).max(160);

type RouteContext = { params: Promise<{ key: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { key } = await context.params;
  return withAdminRoute({
    permission: 'settings.read',
    parse: async () => settingKey.parse(key),
    handler: ({ input }) => listAdminSettingVersions(input)
  })(request);
}
