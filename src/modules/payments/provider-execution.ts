import { PaymentProviderError } from "./provider";

const DEFAULT_PROVIDER_TIMEOUT_MS = 10_000;
const MAX_PROVIDER_TIMEOUT_MS = 30_000;
const MAX_PROVIDER_ATTEMPTS = 2;

function providerTimeoutMs(environment: NodeJS.ProcessEnv): number {
  const configured = Number(environment.PAYMENT_PROVIDER_TIMEOUT_MS);
  if (!Number.isSafeInteger(configured) || configured <= 0) {
    return DEFAULT_PROVIDER_TIMEOUT_MS;
  }
  return Math.min(configured, MAX_PROVIDER_TIMEOUT_MS);
}

async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(
            new PaymentProviderError(
              "PROVIDER_TIMEOUT",
              "The payment provider exceeded the response deadline.",
              true,
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/**
 * Executes only provider operations that are intrinsically read-only or carry
 * a provider idempotency key. A bounded retry prevents an unbounded request
 * storm while allowing one transient failure to recover.
 */
export async function executeProviderOperation<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<T> {
  const timeoutMs = providerTimeoutMs(environment);
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_PROVIDER_ATTEMPTS; attempt += 1) {
    try {
      return await withTimeout(operation, timeoutMs);
    } catch (error) {
      lastError = error;
      if (
        !(error instanceof PaymentProviderError) ||
        !error.retryable ||
        attempt === MAX_PROVIDER_ATTEMPTS
      ) {
        throw error;
      }
    }
  }
  throw lastError;
}
