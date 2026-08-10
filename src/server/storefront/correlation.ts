import { requestId } from "@/server/api/response";

/**
 * Storefront routes pin a single request identifier before parsing or
 * dispatching. The original framework request must be preserved: rebuilding
 * a NextRequest through the platform Request constructor crosses runtime
 * implementations in standalone mode and can detach private Request state.
 * `requestId` keeps a generated identifier in a WeakMap for this request.
 */
export function correlateStoreRequest(request: Request): Request {
  requestId(request);
  return request;
}
