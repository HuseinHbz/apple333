import { defineConfig } from '@playwright/test';

const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  reporter: isCi ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    channel: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: isCi ? 'pnpm start' : 'pnpm dev',
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
    timeout: 120_000
  }
});
