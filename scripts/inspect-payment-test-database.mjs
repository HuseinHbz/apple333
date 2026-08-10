import { PrismaClient } from "@prisma/client";

import {
  EXPECTED_PAYMENT_TEST_DATABASE,
  EXPECTED_PAYMENT_TEST_USER,
  validatePaymentTestEnvironment,
} from "./verify-payment-test-environment.mjs";

const mode = process.argv[2];
if (!["--expect-empty", "--expect-migrated"].includes(mode))
  throw new Error("Use --expect-empty or --expect-migrated.");
const preflight = validatePaymentTestEnvironment(process.env);
if (!preflight.ok) throw new Error(preflight.errors.join(" "));
process.env.DATABASE_URL = process.env.PAYMENT_TEST_DATABASE_URL;

const client = new PrismaClient();
try {
  const identity =
    await client.$queryRaw`SELECT current_database() AS database, current_user AS role`;
  const row = identity[0];
  if (
    row?.database !== EXPECTED_PAYMENT_TEST_DATABASE ||
    row?.role !== EXPECTED_PAYMENT_TEST_USER
  )
    throw new Error("Connected database identity is not owned by Phase 08.");
  const tables = await client.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  const names = tables.map((entry) => entry.tablename);
  if (mode === "--expect-empty" && names.length !== 0)
    throw new Error(
      `Refusing migration: disposable schema is not empty (${names.length} tables).`,
    );
  if (mode === "--expect-migrated") {
    for (const expected of [
      "Order",
      "Payment",
      "PaymentAttempt",
      "PaymentTransaction",
      "PaymentCallback",
      "Refund",
      "PaymentReconciliationRecord",
      "_prisma_migrations",
    ])
      if (!names.includes(expected))
        throw new Error(`Missing migrated table ${expected}.`);
    const trigger = await client.$queryRaw`
      SELECT count(*)::int AS count FROM pg_trigger
      WHERE tgname = 'PaymentTransaction_append_only' AND NOT tgisinternal
    `;
    if (trigger[0]?.count !== 1)
      throw new Error("Append-only payment trigger is missing.");
  }
  console.log(`Payment database inspection passed: ${mode}.`);
} finally {
  await client.$disconnect();
}
