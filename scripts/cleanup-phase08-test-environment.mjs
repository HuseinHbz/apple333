import { spawnSync } from "node:child_process";

import { validatePaymentTestEnvironment } from "./verify-payment-test-environment.mjs";

const destroy = process.argv.includes("--destroy-owned");
if (
  process.argv.some(
    (value, index) =>
      index > 1 && !["--dry-run", "--destroy-owned"].includes(value),
  )
)
  throw new Error("Unsupported cleanup argument.");
const preflight = validatePaymentTestEnvironment(process.env);
if (!preflight.ok) throw new Error(preflight.errors.join(" "));
const resources = [
  ["container", "apple333-phase08-payment-postgres"],
  ["container", "apple333-phase08-payment-redis"],
  ["container", "apple333-phase08-payment-simulator"],
  ["volume", "apple333_phase08_payment_test_postgres_data"],
  ["network", "apple333_phase08_payment_test_network"],
];
for (const [kind, name] of resources) {
  const result = spawnSync(
    "docker",
    [kind, "inspect", name, "--format", "{{json .Labels}}"],
    { encoding: "utf8" },
  );
  if (result.status !== 0) continue;
  const labels = JSON.parse(result.stdout.trim());
  if (
    labels["com.apple333.project"] !== "apple333" ||
    labels["com.apple333.owner"] !== "phase-08" ||
    labels["com.apple333.disposable"] !== "true"
  )
    throw new Error(`Refusing cleanup: ${kind} ${name} is not Phase 08 owned.`);
  console.log(`Verified Phase 08 ownership: ${kind} ${name}`);
}
if (!destroy) {
  console.log(
    "Dry run only. Use --destroy-owned with APPLE333_PHASE08_CLEANUP_ACK=DELETE_OWNED_PHASE08_RESOURCES.",
  );
} else {
  if (
    process.env.APPLE333_PHASE08_CLEANUP_ACK !==
    "DELETE_OWNED_PHASE08_RESOURCES"
  )
    throw new Error("Explicit Phase 08 cleanup acknowledgement is required.");
  const result = spawnSync(
    "docker",
    [
      "compose",
      "--env-file",
      ".env.payment-test",
      "-f",
      "docker-compose.payment-test.yml",
      "down",
      "--volumes",
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error("Owned Phase 08 cleanup failed.");
}
