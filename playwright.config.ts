import { defineConfig } from '@playwright/test';

const isCi = Boolean(process.env.CI);
const requestedServerMode = process.env.APPLE333_E2E_SERVER_MODE;
const defaultServerMode = isCi
  ? (process.platform === 'win32' ? 'next-start' : 'standalone')
  : 'dev';
const serverMode = requestedServerMode ?? defaultServerMode;

if (!['dev', 'next-start', 'standalone'].includes(serverMode)) {
  throw new Error('APPLE333_E2E_SERVER_MODE must be one of dev, next-start, or standalone.');
}

const webServerCommand = serverMode === 'standalone'
  ? 'pnpm start:standalone'
  : serverMode === 'next-start'
    ? 'pnpm exec next start --hostname 127.0.0.1 --port 3000'
    : 'pnpm dev';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  // Keep GitHub annotations while also emitting a portable HTML report that
  // the CI workflow retains as evidence for every run.
  reporter: isCi
    ? [
      ['github'],
      ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ]
    : 'list',
  outputDir: 'test-results',
  // CI retains test attachments (including the axe JSON attachments) even
  // after a passing run. Video, trace, and screenshot capture remains
  // failure-scoped so the 26-test suite keeps its existing runtime profile.
  preserveOutput: isCi ? 'always' : 'failures-only',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    channel: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    // Windows CI cannot reliably preserve the standalone dependency links.
    // Use `next start` there after the existing build gate; Linux CI continues
    // to validate the production standalone artifact.
    command: webServerCommand,
    env: {
      ...process.env,
      APP_URL: process.env.APP_URL ?? 'http://127.0.0.1:3000',
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'test-only-auth-secret-with-at-least-32-characters',
      AUTH_URL: process.env.AUTH_URL ?? 'http://127.0.0.1:3000',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? 'test-only-auth-secret-with-at-least-32-characters',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'http://127.0.0.1:3000'
    },
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !isCi,
    // The CI command streams this process output through a sanitizer before
    // retaining it as a diagnostic artifact. Local runs keep stdout quiet.
    name: 'Apple333 storefront',
    stdout: isCi ? 'pipe' : 'ignore',
    stderr: 'pipe',
    timeout: 120_000
  }
});
