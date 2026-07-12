import { z } from 'zod';

import {
  productSpecificationInput,
  productSpecificationsInput,
  type ProductSpecificationInput,
} from '@/modules/pim/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { addAdminProductSpecifications } from '@/server/services/pim-service';

type RouteContext = { params: Promise<{ id: string }> };
const specificationPayload = z.union([
  productSpecificationInput,
  productSpecificationsInput.transform((value) => value.specifications),
]);

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return withAdminRoute<{ productId: string; specifications: readonly ProductSpecificationInput[] }>({
    permission: 'products.update',
    mutation: true,
    parse: async (incoming) => {
      const payload = await jsonBody(specificationPayload)(incoming);
      return {
        productId: z.string().cuid().parse(id),
        specifications: Array.isArray(payload) ? payload : [payload],
      };
    },
    handler: ({ input, audit }) => addAdminProductSpecifications(input.productId, input.specifications, audit),
  })(request);
}
