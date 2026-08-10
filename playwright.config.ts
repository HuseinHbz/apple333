import { defineConfig } from "@playwright/test";

const isCi = Boolean(process.env.CI);
const requestedServerMode = process.env.APPLE333_E2E_SERVER_MODE;
const requestedE2ePort = process.env.APPLE333_E2E_PORT ?? "3000";

if (
  !/^[1-9]\d{0,4}$/.test(requestedE2ePort) ||
  Number(requestedE2ePort) > 65_535
) {
  throw new Error("APPLE333_E2E_PORT must be a TCP port between 1 and 65535.");
}

const e2eBaseUrl = `http://127.0.0.1:${requestedE2ePort}`;
const reuseExistingServer =
  process.env.APPLE333_E2E_REUSE_EXISTING_SERVER === "1" || !isCi;
const defaultServerMode = isCi
  ? process.platform === "win32"
    ? "next-start"
    : "standalone"
  : "dev";
const serverMode = requestedServerMode ?? defaultServerMode;

if (!["dev", "next-start", "standalone"].includes(serverMode)) {
  throw new Error(
    "APPLE333_E2E_SERVER_MODE must be one of dev, next-start, or standalone.",
  );
}

// Run the standalone Node entrypoint directly. Wrapping it in a nested pnpm
// process prevents Playwright from reliably terminating the server on Windows.
const webServerCommand =
  serverMode === "standalone"
    ? "node .next/standalone/server.js"
    : serverMode === "next-start"
      ? `pnpm exec next start --hostname 127.0.0.1 --port ${requestedE2ePort}`
      : `pnpm exec next dev --hostname 127.0.0.1 --port ${requestedE2ePort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  // Keep GitHub annotations while also emitting a portable HTML report that
  // the CI workflow retains as evidence for every run.
  reporter: isCi
    ? [
        ["github"],
        ["html", { outputFolder: "playwright-report", open: "never" }],
      ]
    : "list",
  outputDir: "test-results",
  // CI retains test attachments (including the axe JSON attachments) even
  // after a passing run. Video, trace, and screenshot capture remains
  // failure-scoped so the 26-test suite keeps its existing runtime profile.
  preserveOutput: isCi ? "always" : "failures-only",
  use: {
    baseURL: e2eBaseUrl,
    channel: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    // Windows CI cannot reliably preserve the standalone dependency links.
    // Use `next start` there after the existing build gate; Linux CI continues
    // to validate the production standalone artifact.
    command: webServerCommand,
    env: {
      ...process.env,
      PORT: requestedE2ePort,
      APP_URL: process.env.APP_URL ?? e2eBaseUrl,
      AUTH_SECRET:
        process.env.AUTH_SECRET ??
        "test-only-auth-secret-with-at-least-32-characters",
      AUTH_URL: process.env.AUTH_URL ?? e2eBaseUrl,
      NEXTAUTH_SECRET:
        process.env.NEXTAUTH_SECRET ??
        "test-only-auth-secret-with-at-least-32-characters",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? e2eBaseUrl,
    },
    url: e2eBaseUrl,
    reuseExistingServer,
    // The CI command streams this process output through a sanitizer before
    // retaining it as a diagnostic artifact. Local runs keep stdout quiet.
    name: "Apple333 storefront",
    stdout: isCi ? "pipe" : "ignore",
    stderr: "pipe",
    timeout: 120_000,
  },
});
