import { inventorySkuRouteInput } from '@/modules/inventory/validators';
import { inventoryAvailabilityBySku } from '@/server/services/inventory-service';
import { privateStoreResponse, runStoreRoute } from '@/server/storefront/route';

type RouteContext = { params: Promise<{ sku: string }> };

/**
 * Public, privacy-safe availability projection. It intentionally returns only
 * branch identity and an availability band; it never exposes quantities,
 * warehouses, locations, IMEI, serials, reservations, or movements.
 */
export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  return runStoreRoute(request, {
    rateLimitKey: 'public.inventory-availability',
    parse: async () => inventorySkuRouteInput.parse(await params),
    handler: async (input) => privateStoreResponse(request, await inventoryAvailabilityBySku(input.sku)),
  });
}
