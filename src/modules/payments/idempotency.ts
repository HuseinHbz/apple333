import { createHash } from "node:crypto";

export function stablePaymentSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stablePaymentSerialize).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${stablePaymentSerialize(record[key])}`,
    )
    .join(",")}}`;
}

export function paymentRequestHash(value: unknown): string {
  return createHash("sha256")
    .update(stablePaymentSerialize(value))
    .digest("hex");
}

export function paymentPayloadHash(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}
