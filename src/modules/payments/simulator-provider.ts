import { createHmac, timingSafeEqual } from "node:crypto";

import {
  PaymentProviderError,
  type PaymentProvider,
  type ProviderCallbackEvidence,
  type ProviderPaymentRequest,
  type ProviderPaymentResult,
  type ProviderRefundRequest,
  type ProviderRefundResult,
  type ProviderVerificationRequest,
} from "./provider";
import type { PaymentSimulatorScenario } from "./types";

const AUTHORITY_PATTERN = /^SIM-([a-z_]+)-([A-Za-z0-9]+)-([0-9]+)-([A-Z]{3})$/;

function reference(authority: string): string {
  return `REF-${createHmac("sha256", "apple333-simulator-reference")
    .update(authority)
    .digest("hex")
    .slice(0, 20)
    .toUpperCase()}`;
}

function resultFor(
  authority: string,
  scenario: PaymentSimulatorScenario,
  amountRials: bigint,
  currency: string,
): ProviderPaymentResult {
  const base = {
    authority,
    amountRials: scenario === "wrong_amount" ? amountRials + 1n : amountRials,
    currency,
    expiresAt: new Date(Date.now() + 15 * 60 * 1_000),
  };
  if (scenario === "cancelled") {
    return {
      ...base,
      status: "CANCELLED",
      reference: null,
      providerCode: "USER_CANCELLED",
      redirectUrl: null,
    };
  }
  if (scenario === "declined") {
    return {
      ...base,
      status: "FAILED",
      reference: null,
      providerCode: "DECLINED",
      redirectUrl: null,
    };
  }
  if (scenario === "expired") {
    return {
      ...base,
      status: "EXPIRED",
      reference: null,
      providerCode: "EXPIRED",
      redirectUrl: null,
      expiresAt: new Date(Date.now() - 1),
    };
  }
  return {
    ...base,
    status: "PAID",
    reference: reference(authority),
    providerCode: "SIMULATED_SUCCESS",
    redirectUrl: null,
  };
}

export class PaymentSimulatorProvider implements PaymentProvider {
  public readonly code = "PAYMENT_SIMULATOR";

  public constructor(
    private readonly secret: string,
    private readonly publicBaseUrl: string,
  ) {
    if (secret.length < 32) {
      throw new Error(
        "Payment simulator secret must contain at least 32 characters.",
      );
    }
    const origin = new URL(publicBaseUrl);
    if (!["http:", "https:"].includes(origin.protocol)) {
      throw new Error("Payment simulator URL must use HTTP or HTTPS.");
    }
  }

  public async initializePayment(
    input: ProviderPaymentRequest,
  ): Promise<ProviderPaymentResult> {
    if (input.scenario === "timeout") {
      throw new PaymentProviderError(
        "PROVIDER_TIMEOUT",
        "The simulator intentionally timed out.",
        true,
      );
    }
    if (input.scenario === "network_retry") {
      throw new PaymentProviderError(
        "PROVIDER_UNAVAILABLE",
        "The simulator requested a bounded retry.",
        true,
      );
    }
    const suffix = input.paymentId.replace(/[^A-Za-z0-9]/g, "").slice(-12);
    const requestSuffix = createHmac("sha256", this.secret)
      .update(input.idempotencyKey)
      .digest("hex")
      .slice(0, 8);
    const authority = `SIM-${input.scenario}-${suffix}${requestSuffix}-${input.amountRials}-${input.currency}`;
    return {
      status: "PENDING",
      authority,
      reference: null,
      amountRials: input.amountRials,
      currency: input.currency,
      providerCode: "SIMULATED_INITIALIZED",
      redirectUrl: `${this.publicBaseUrl}/checkout/payment/${encodeURIComponent(input.paymentId)}/return?authority=${encodeURIComponent(authority)}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1_000),
    };
  }

  public async verifyPayment(
    input: ProviderVerificationRequest,
  ): Promise<ProviderPaymentResult> {
    const parsed = AUTHORITY_PATTERN.exec(input.authority);
    if (!parsed) {
      throw new PaymentProviderError(
        "PROVIDER_UNKNOWN_AUTHORITY",
        "Unknown simulator authority.",
        false,
      );
    }
    const [, rawScenario, , rawAmount, currency] = parsed;
    const scenario = rawScenario as PaymentSimulatorScenario;
    if (scenario === "unknown_authority") {
      throw new PaymentProviderError(
        "PROVIDER_UNKNOWN_AUTHORITY",
        "Unknown simulator authority.",
        false,
      );
    }
    if (scenario === "timeout" || scenario === "network_retry") {
      throw new PaymentProviderError(
        scenario === "timeout" ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE",
        "Simulator verification is temporarily unavailable.",
        true,
      );
    }
    return resultFor(
      input.authority,
      scenario,
      BigInt(rawAmount ?? input.expectedAmountRials),
      currency ?? input.expectedCurrency,
    );
  }

  public queryPayment(
    input: ProviderVerificationRequest,
  ): Promise<ProviderPaymentResult> {
    return this.verifyPayment(input);
  }

  public async cancelPaymentWhenSupported(): Promise<boolean> {
    return true;
  }

  public async refundPaymentWhenSupported(
    input: ProviderRefundRequest,
  ): Promise<ProviderRefundResult> {
    if (input.scenario === "refund_failure") {
      return {
        succeeded: false,
        reference: null,
        providerCode: "SIMULATED_REFUND_FAILED",
      };
    }
    return {
      succeeded: true,
      reference: `RFD-${createHmac("sha256", this.secret)
        .update(`${input.paymentReference}:${input.idempotencyKey}`)
        .digest("hex")
        .slice(0, 20)
        .toUpperCase()}`,
      providerCode: "SIMULATED_REFUND_SUCCESS",
    };
  }

  public async validateCallback(
    evidence: ProviderCallbackEvidence,
  ): Promise<boolean> {
    const expected = this.signCallback(evidence.rawPayload);
    const supplied = Buffer.from(evidence.signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    return (
      supplied.length === expectedBuffer.length &&
      timingSafeEqual(supplied, expectedBuffer)
    );
  }

  public signCallback(rawPayload: string): string {
    return createHmac("sha256", this.secret).update(rawPayload).digest("hex");
  }
}

let cachedSimulator: PaymentSimulatorProvider | undefined;

/** Lazily resolves only the deterministic simulator; production providers are gated. */
export function paymentSimulatorProvider(): PaymentSimulatorProvider {
  if (cachedSimulator) return cachedSimulator;
  const production = process.env.NODE_ENV === "production";
  const secret = process.env.PAYMENT_SIMULATOR_SECRET;
  if (production && !secret) {
    throw new Error(
      "PAYMENT_SIMULATOR_SECRET is required in production runtime.",
    );
  }
  const appUrl = process.env.APP_URL ?? "http://127.0.0.1:3000";
  cachedSimulator = new PaymentSimulatorProvider(
    secret ?? "apple333-phase08-disposable-simulator-secret",
    new URL(appUrl).origin,
  );
  return cachedSimulator;
}

export function resetPaymentSimulatorForTests(): void {
  cachedSimulator = undefined;
}
