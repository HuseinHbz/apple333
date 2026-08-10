import { describe, expect, it, vi } from "vitest";

import { PaymentProviderError } from "@/modules/payments/provider";
import { executeProviderOperation } from "@/modules/payments/provider-execution";

describe("Phase 08 bounded provider execution", () => {
  it("retries one transient provider failure and returns the canonical result", async () => {
    const operation = vi
      .fn<(_signal: AbortSignal) => Promise<string>>()
      .mockRejectedValueOnce(
        new PaymentProviderError(
          "PROVIDER_UNAVAILABLE",
          "Temporary outage",
          true,
        ),
      )
      .mockResolvedValue("completed");

    await expect(executeProviderOperation(operation)).resolves.toBe(
      "completed",
    );
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-retryable provider rejection", async () => {
    const operation = vi.fn(async () => {
      throw new PaymentProviderError("PROVIDER_DECLINED", "Declined", false);
    });

    await expect(executeProviderOperation(operation)).rejects.toMatchObject({
      code: "PROVIDER_DECLINED",
    });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("aborts timed-out attempts and stops after the bounded retry", async () => {
    const observedSignals: AbortSignal[] = [];
    const operation = vi.fn((signal: AbortSignal) => {
      observedSignals.push(signal);
      return new Promise<never>(() => undefined);
    });

    await expect(
      executeProviderOperation(operation, {
        NODE_ENV: "test",
        PAYMENT_PROVIDER_TIMEOUT_MS: "5",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT", retryable: true });
    expect(operation).toHaveBeenCalledTimes(2);
    expect(observedSignals.every((signal) => signal.aborted)).toBe(true);
  });
});
