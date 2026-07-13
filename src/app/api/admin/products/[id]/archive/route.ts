import { z } from 'zod';

import { productWorkflowInput, type ProductWorkflowInput } from '@/modules/pim/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { archiveAdminProduct } from '@/server/services/pim-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute<{ id: string; input: ProductWorkflowInput }>({
    permission: 'products.publish',
    mutation: true,
    parse: async (incoming) => ({ id: z.string().cuid().parse(id), input: await jsonBody(productWorkflowInput)(incoming) }),
    handler: ({ input, audit }) => archiveAdminProduct(input.id, input.input, audit),
  })(request);
}
