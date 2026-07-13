import { z } from 'zod';

import { categoryAttributeAssignmentInput, type CategoryAttributeAssignmentInput } from '@/modules/pim/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { assignAdminCategoryAttribute } from '@/server/services/pim-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute<{ categoryId: string; input: CategoryAttributeAssignmentInput }>({
    permission: 'categories.update',
    mutation: true,
    parse: async (incoming) => ({ categoryId: z.string().cuid().parse(id), input: await jsonBody(categoryAttributeAssignmentInput)(incoming) }),
    handler: async ({ input, audit }) => {
      await assignAdminCategoryAttribute(input.categoryId, input.input, audit);
      return { assigned: true };
    },
  })(request);
}
