import { upsertSettingInput, type UpsertSettingInput } from '@/modules/settings/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { listAdminSettings, upsertAdminSetting } from '@/server/services/setting-service';

export const GET = withAdminRoute({
  permission: 'settings.read',
  handler: () => listAdminSettings()
});

export const PATCH = withAdminRoute<UpsertSettingInput>({
  permission: 'settings.update',
  mutation: true,
  parse: jsonBody(upsertSettingInput),
  handler: ({ input, audit }) => upsertAdminSetting(input, audit)
});
