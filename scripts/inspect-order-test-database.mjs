import { Prisma, PrismaClient } from "@prisma/client";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_ORDER_TEST_DATABASE,
  EXPECTED_ORDER_TEST_USER,
  validateOrderTestEnvironment,
} from "./verify-order-test-environment.mjs";

export const PHASE_07_ORDER_MIGRATION =
  "20260729000000_phase_07_order_management";

const expectedApplicationTables = new Set(
  Prisma.dmmf.datamodel.models.map((model) => model.dbName ?? model.name),
);

/**
 * PostgreSQL installs plpgsql in public by default. Its presence alone does
 * not mean a disposable test database contains application schema state.
 */
export function isExpectedPristinePublicObject(object) {
  return object?.kind === "extension" && object?.name === "plpgsql";
}

export function expectationFromArguments(argumentsList) {
  const requested = argumentsList
    .slice(2)
    .filter((argument) => argument.startsWith("--expect-"));
  if (
    requested.length !== 1 ||
    !["--expect-empty", "--expect-migrated"].includes(requested[0])
  ) {
    throw new Error("Use exactly one of --expect-empty or --expect-migrated.");
  }
  return requested[0] === "--expect-empty" ? "empty" : "migrated";
}

async function inspect() {
  const preflight = validateOrderTestEnvironment(process.env);
  if (!preflight.ok) {
    throw new Error(
      `Order test environment preflight failed: ${preflight.errors.join(" ")}`,
    );
  }

  const expectation = expectationFromArguments(process.argv);
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.ORDER_TEST_DATABASE_URL } },
  });

  try {
    const identityRows = await prisma.$queryRaw`
      SELECT
        current_database() AS database,
        current_user AS role,
        current_schema() AS schema,
        inet_server_addr()::text AS "serverAddress",
        inet_server_port() AS "serverPort"
    `;
    const identity = identityRows[0];
    if (
      !identity ||
      identity.database !== EXPECTED_ORDER_TEST_DATABASE ||
      identity.role !== EXPECTED_ORDER_TEST_USER ||
      identity.schema !== "public"
    ) {
      throw new Error(
        "Connected database identity does not match the isolated Phase 07 order test target.",
      );
    }

    const publicObjects = await prisma.$queryRaw`
      SELECT object_kind AS kind, object_name AS name
      FROM (
        SELECT ('relation:' || c.relkind::text) AS object_kind, c.relname AS object_name
        FROM pg_catalog.pg_class AS c
        INNER JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f', 'c')
        UNION ALL
        SELECT ('type:' || t.typtype::text) AS object_kind, t.typname AS object_name
        FROM pg_catalog.pg_type AS t
        INNER JOIN pg_catalog.pg_namespace AS n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typtype IN ('e', 'd', 'r')
        UNION ALL
        SELECT ('routine:' || p.prokind::text) AS object_kind, p.proname AS object_name
        FROM pg_catalog.pg_proc AS p
        INNER JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
        UNION ALL
        SELECT 'extension' AS object_kind, e.extname AS object_name
        FROM pg_catalog.pg_extension AS e
        INNER JOIN pg_catalog.pg_namespace AS n ON n.oid = e.extnamespace
      ) AS public_schema_objects
      ORDER BY kind ASC, name ASC
    `;
    const unexpectedPublicObjects = publicObjects.filter(
      (object) => !isExpectedPristinePublicObject(object),
    );
    if (expectation === "empty" && unexpectedPublicObjects.length !== 0) {
      throw new Error(
        "Expected a pristine isolated Phase 07 order test database before migration; public schema objects already exist.",
      );
    }

    const tables = await prisma.$queryRaw`
      SELECT table_name AS name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `;
    const tableNames = tables.map((row) => row.name);

    if (expectation === "migrated") {
      const expectedTables = new Set([
        ...expectedApplicationTables,
        "_prisma_migrations",
      ]);
      const missingTables = [...expectedTables].filter(
        (table) => !tableNames.includes(table),
      );
      const unexpectedTables = tableNames.filter(
        (table) => !expectedTables.has(table),
      );
      if (missingTables.length > 0 || unexpectedTables.length > 0) {
        throw new Error(
          `Migration verification failed; missing=${missingTables.length}, unexpected=${unexpectedTables.length}.`,
        );
      }

      const migrations = await prisma.$queryRaw`
        SELECT migration_name AS name, checksum, finished_at AS "finishedAt", rolled_back_at AS "rolledBackAt"
        FROM "_prisma_migrations"
        ORDER BY finished_at ASC NULLS LAST, migration_name ASC
      `;
      const phaseMigration = migrations.find(
        (migration) => migration.name === PHASE_07_ORDER_MIGRATION,
      );
      if (
        !phaseMigration ||
        !phaseMigration.checksum ||
        !phaseMigration.finishedAt ||
        phaseMigration.rolledBackAt
      ) {
        throw new Error(
          "Migration verification failed; the Phase 07 order-management migration is not completed with a checksum.",
        );
      }
      const unhealthyMigration = migrations.find(
        (migration) => !migration.finishedAt || migration.rolledBackAt,
      );
      if (unhealthyMigration) {
        throw new Error(
          `Migration verification failed; ${unhealthyMigration.name} is incomplete or rolled back.`,
        );
      }
    }

    console.log(
      `Order test database verified: database=${identity.database}, role=${identity.role}, schema=${identity.schema}, server=${identity.serverAddress ?? "unknown"}:${identity.serverPort ?? "unknown"}, tables=${tableNames.length}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  inspect().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Order test database inspection failed.",
    );
    process.exitCode = 1;
  });
}
