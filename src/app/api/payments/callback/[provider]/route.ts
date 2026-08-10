import {
  paymentCallbackInput,
  paymentProviderRouteInput,
} from "@/modules/payments/validators";
import { requestId, success, failure } from "@/server/api/response";
import { log } from "@/server/logging/logger";
import {
  assertRateLimit,
  requestIp,
  requestUserAgent,
} from "@/server/security/request-security";
import { processPaymentCallback } from "@/server/services/payment-service";

type RouteContext = Readonly<{ params: Promise<{ provider: string }> }>;

async function process(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const meta = { requestId: requestId(request) };
  const startedAt = Date.now();
  let provider = "unknown";
  try {
    assertRateLimit(
      `${requestIp(request) ?? "anonymous"}:payment.provider-callback`,
      90,
    );
    ({ provider } = paymentProviderRouteInput.parse(await context.params));
    const rawPayload =
      request.method === "GET"
        ? JSON.stringify(Object.fromEntries(new URL(request.url).searchParams))
        : await request.text();
    if (rawPayload.length > 8_192) paymentCallbackInput.parse(null);
    let candidate: unknown;
    if (request.method === "GET") {
      candidate = Object.fromEntries(new URL(request.url).searchParams);
    } else {
      try {
        candidate = JSON.parse(rawPayload) as unknown;
      } catch {
        candidate = null;
      }
    }
    const parsed = paymentCallbackInput.parse(candidate);
    const ipAddress = requestIp(request);
    const userAgent = requestUserAgent(request);
    const result = await processPaymentCallback(provider, parsed, rawPayload, {
      ...meta,
      ...(ipAddress ? { ipAddress } : {}),
      ...(userAgent ? { userAgent } : {}),
    });
    const completedLog = {
      requestId: meta.requestId,
      paymentId:
        "id" in result && typeof result.id === "string" ? result.id : undefined,
      provider,
      operation: "callback",
      result: "accepted",
      durationMs: Date.now() - startedAt,
    };
    log("info", "payment_callback_completed", completedLog);
    const response = success(result, meta);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  } catch (error) {
    const rejectedLog = {
      requestId: meta.requestId,
      provider,
      operation: "callback",
      result: "rejected",
      durationMs: Date.now() - startedAt,
      errorCode: error instanceof Error ? error.name : "UNKNOWN",
    };
    log("warn", "payment_callback_rejected", rejectedLog);
    return failure(error, meta);
  }
}

export const GET = process;
export const POST = process;
