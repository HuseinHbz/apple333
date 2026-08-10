import { readServerEnv } from "@/config/env";
import { checkRedisHealth } from "@/server/cache/redis";
import { recordReadiness } from "@/server/monitoring/metrics";
import { prisma } from "@/server/db/prisma";

export type ReadinessCheckStatus = "ok" | "disabled" | "unavailable";

export type ReadinessResult = {
  ready: boolean;
  checks: {
    configuration: ReadinessCheckStatus;
    database: ReadinessCheckStatus;
    orders: ReadinessCheckStatus;
    redis: ReadinessCheckStatus;
  };
};

const REQUIRED_ORDER_TABLES = [
  "Order",
  "OrderItem",
  "OrderAllocation",
  "OrderDeviceAssignment",
  "OrderPayment",
  "OrderFulfillment",
  "OrderStatusHistory",
  "OrderIdempotencyRecord",
  "OrderOutboxEvent",
] as const;

async function databaseStatus(): Promise<ReadinessCheckStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch {
    return "unavailable";
  }
}

/**
 * Database connectivity alone is not sufficient after Phase 07: accepting
 * traffic while the OMS migration is absent would make checkout fail later
 * and could leave users with an ambiguous order state. The static table list
 * avoids accepting arbitrary identifiers from runtime configuration.
 */
async function orderSchemaStatus(): Promise<ReadinessCheckStatus> {
  try {
    const rows = await prisma.$queryRaw<
      readonly Readonly<{ tableName: string; relationName: string | null }>[]
    >`
      SELECT required.table_name AS "tableName", to_regclass('public.' || quote_ident(required.table_name))::text AS "relationName"
      FROM unnest(ARRAY['Order', 'OrderItem', 'OrderAllocation', 'OrderDeviceAssignment', 'OrderPayment', 'OrderFulfillment', 'OrderStatusHistory', 'OrderIdempotencyRecord', 'OrderOutboxEvent']::text[]) AS required(table_name)
    `;
    return rows.length === REQUIRED_ORDER_TABLES.length &&
      rows.every((row) => row.relationName !== null)
      ? "ok"
      : "unavailable";
  } catch {
    return "unavailable";
  }
}

export async function readiness(): Promise<ReadinessResult> {
  const startedAt = performance.now();

  try {
    readServerEnv();
  } catch {
    const result: ReadinessResult = {
      ready: false,
      checks: {
        configuration: "unavailable",
        database: "unavailable",
        orders: "unavailable",
        redis: "unavailable",
      },
    };
    recordReadiness(result, performance.now() - startedAt);
    return result;
  }

  const [database, orders, redis] = await Promise.all([
    databaseStatus(),
    orderSchemaStatus(),
    checkRedisHealth(),
  ]);
  const result: ReadinessResult = {
    ready:
      database === "ok" &&
      orders === "ok" &&
      (redis.status === "ok" || redis.status === "disabled"),
    checks: {
      configuration: "ok",
      database,
      orders,
      redis: redis.status,
    },
  };

  recordReadiness(result, performance.now() - startedAt);
  return result;
}
