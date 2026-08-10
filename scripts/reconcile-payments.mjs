import { PrismaClient } from "@prisma/client";

import { validatePaymentTestEnvironment } from "./verify-payment-test-environment.mjs";

const preflight = validatePaymentTestEnvironment(process.env);
if (!preflight.ok) throw new Error(preflight.errors.join(" "));
process.env.DATABASE_URL = process.env.PAYMENT_TEST_DATABASE_URL;
const prisma = new PrismaClient();
try {
  const rows = await prisma.$queryRaw`
    SELECT
      p."id",
      CASE
        WHEN p."amountRials" <> o."grandTotalRials" THEN 'AMOUNT_MISMATCH'
        WHEN p."currency" <> o."currency" THEN 'CURRENCY_MISMATCH'
        WHEN p."status" IN ('PAID','PARTIALLY_REFUNDED','REFUNDED')
             AND o."paymentStatus" NOT IN ('PAID','PARTIALLY_REFUNDED','REFUNDED') THEN 'ORDER_STATUS_MISMATCH'
        WHEN COALESCE(r.total, 0) > p."amountRials" THEN 'REFUND_LIMIT_EXCEEDED'
        ELSE 'NONE'
      END AS difference
    FROM "Payment" p
    JOIN "Order" o ON o."id" = p."orderId"
    LEFT JOIN (
      SELECT "paymentId", SUM("amountRials") AS total
      FROM "Refund" WHERE "status" IN ('PENDING','SUCCEEDED')
      GROUP BY "paymentId"
    ) r ON r."paymentId" = p."id"
  `;
  const counts = {};
  for (const row of rows)
    counts[row.difference] = (counts[row.difference] ?? 0) + 1;
  const mismatches = rows.filter((row) => row.difference !== "NONE").length;
  console.log(
    JSON.stringify(
      { checked: rows.length, mismatches, differences: counts },
      null,
      2,
    ),
  );
  if (mismatches > 0) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
