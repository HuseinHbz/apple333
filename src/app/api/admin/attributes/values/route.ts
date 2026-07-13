import { createAttributeValueInput, type CreateAttributeValueInput } from '@/modules/pim/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { createAdminAttributeValue } from '@/server/services/pim-service';

export const POST = withAdminRoute<CreateAttributeValueInput>({
  permission: 'attributes.create',
  mutation: true,
  parse: jsonBody(createAttributeValueInput),
  handler: async ({ input, audit }) => {
    await createAdminAttributeValue(input, audit);
    return { created: true };
  },
  status: 201,
});
