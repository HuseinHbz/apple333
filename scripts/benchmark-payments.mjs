import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { PrismaClient } from "@prisma/client";

import { validatePaymentTestEnvironment } from "./verify-payment-test-environment.mjs";

const preflight = validatePaymentTestEnvironment(process.env);
if (!preflight.ok) throw new Error(preflight.errors.join(" "));
process.env.DATABASE_URL = process.env.PAYMENT_TEST_DATABASE_URL;
const requestedIndex = process.argv.indexOf("--dataset");
const requested =
  requestedIndex >= 0 ? Number(process.argv[requestedIndex + 1]) : null;
const datasets = requested ? [requested] : [10_000, 100_000];
if (datasets.some((value) => ![10_000, 100_000].includes(value)))
  throw new Error("Payment benchmark dataset must be 10000 or 100000.");

const targets = {
  payment_lookup_p95_ms: 150,
  admin_payment_list_p95_ms: 250,
  payment_initialization_internal_p95_ms: 300,
  callback_processing_p95_ms: 300,
  reconciliation_lookup_p95_ms: 250,
};
const prisma = new PrismaClient();

function percentile(values, percentileValue) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil((percentileValue / 100) * sorted.length) - 1] ?? 0;
}

async function measure(operation, iterations = 50) {
  const values = [];
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    await operation(index);
    values.push(performance.now() - started);
  }
  return Number(percentile(values, 95).toFixed(3));
}

try {
  await mkdir("artifacts/phase-08", { recursive: true });
  for (const dataset of datasets) {
    const token = `b${Date.now().toString(36)}${dataset}`;
    await prisma.$executeRaw`
      INSERT INTO "Order" (
        "id", "orderNumber", "source", "type", "customerSnapshot",
        "currency", "subtotalRials", "grandTotalRials", "paymentStatus",
        "fulfillmentStatus", "fulfillmentMethod", "orderStatus",
        "allocationStatus", "version", "createdAt", "updatedAt"
      )
      SELECT
        ${token} || '-order-' || series,
        'A33-BENCH-' || ${token} || '-' || series,
        'API'::"OrderSource",
        'STANDARD_SALE'::"OrderType",
        jsonb_build_object('benchmark', true),
        'IRR',
        (1000000 + series)::bigint,
        (1000000 + series)::bigint,
        'UNPAID'::"OrderPaymentStatus",
        'UNFULFILLED'::"OrderFulfillmentStatus",
        'DELIVERY'::"OrderFulfillmentMethod",
        'PENDING_CONFIRMATION'::"OrderStatus",
        'UNALLOCATED'::"OrderAllocationStatus",
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM generate_series(1, ${dataset}) AS series
    `;
    await prisma.$executeRaw`
      INSERT INTO "Payment" (
        "id", "orderId", "paymentNumber", "currency", "amountRials",
        "status", "method", "provider", "version", "createdAt", "updatedAt"
      )
      SELECT
        ${token} || '-payment-' || series,
        ${token} || '-order-' || series,
        'PAY-BENCH-' || ${token} || '-' || series,
        'IRR',
        (1000000 + series)::bigint,
        'CREATED'::"PaymentStatus",
        'ONLINE'::"PaymentMethod",
        'PAYMENT_SIMULATOR',
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM generate_series(1, ${dataset}) AS series
    `;
    await prisma.$executeRaw`
      INSERT INTO "PaymentAttempt" (
        "id", "paymentId", "attemptNumber", "provider", "amountRials",
        "currency", "status", "idempotencyKey", "providerAuthority",
        "createdAt", "updatedAt"
      )
      SELECT
        ${token} || '-attempt-' || series,
        ${token} || '-payment-' || series,
        1,
        'PAYMENT_SIMULATOR',
        (1000000 + series)::bigint,
        'IRR',
        'PENDING'::"PaymentAttemptStatus",
        ${token} || '-idempotency-' || series,
        'SIM-benchmark-' || ${token} || '-' || series,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM generate_series(1, ${dataset}) AS series
    `;

    const lookupP95 = await measure((index) =>
      prisma.payment.findUnique({
        where: { paymentNumber: `PAY-BENCH-${token}-${(index % dataset) + 1}` },
        select: { id: true, status: true, amountRials: true },
      }),
    );
    const adminP95 = await measure(() =>
      prisma.payment.findMany({
        where: { provider: "PAYMENT_SIMULATOR", status: "CREATED" },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: { id: true, paymentNumber: true, amountRials: true },
      }),
    );
    const initializationP95 = await measure((index) =>
      prisma.payment.findFirst({
        where: {
          id: `${token}-payment-${(index % dataset) + 1}`,
          status: { in: ["CREATED", "FAILED", "EXPIRED"] },
        },
        select: {
          id: true,
          orderId: true,
          amountRials: true,
          currency: true,
          version: true,
        },
      }),
    );
    const callbackP95 = await measure((index) =>
      prisma.paymentAttempt.findUnique({
        where: {
          provider_providerAuthority: {
            provider: "PAYMENT_SIMULATOR",
            providerAuthority: `SIM-benchmark-${token}-${(index % dataset) + 1}`,
          },
        },
        select: { id: true, paymentId: true, amountRials: true },
      }),
    );
    const reconciliationP95 = await measure((index) =>
      prisma.payment.findUnique({
        where: { id: `${token}-payment-${(index % dataset) + 1}` },
        select: {
          status: true,
          amountRials: true,
          currency: true,
          order: {
            select: {
              grandTotalRials: true,
              currency: true,
              paymentStatus: true,
            },
          },
        },
      }),
    );
    const measurements = {
      payment_lookup_p95_ms: lookupP95,
      admin_payment_list_p95_ms: adminP95,
      payment_initialization_internal_p95_ms: initializationP95,
      callback_processing_p95_ms: callbackP95,
      reconciliation_lookup_p95_ms: reconciliationP95,
    };
    const failed = Object.entries(measurements).filter(
      ([name, value]) => value > targets[name],
    );
    const report = {
      phase: "08",
      dataset,
      rows: { orders: dataset, payments: dataset, attempts: dataset },
      internalMeasurementsMs: measurements,
      targetsMs: targets,
      externalGatewayLatency:
        "excluded; deterministic simulator was not called",
      passed: failed.length === 0,
      generatedAt: new Date().toISOString(),
    };
    await writeFile(
      `artifacts/phase-08/payment-benchmark-${dataset}.json`,
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    console.log(JSON.stringify(report, null, 2));
    if (failed.length > 0) process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}
