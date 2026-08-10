import { updateInventorySkuPolicyInput, type UpdateInventorySkuPolicyInput } from '@/modules/inventory/validators';
import { jsonBody, withAdminRoute } from '@/server/admin/route';
import { configureSkuTracking } from '@/server/services/inventory-service';

export const POST = withAdminRoute<UpdateInventorySkuPolicyInput>({
  permission: 'inventory.policy.update',
  mutation: true,
  parse: jsonBody(updateInventorySkuPolicyInput),
  handler: ({ actor, input, audit }) => configureSkuTracking(actor, input, audit),
});
