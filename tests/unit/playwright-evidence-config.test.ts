import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadCiConfig() {
  vi.resetModules();
  vi.stubEnv('CI', '1');
  vi.stubEnv('APPLE333_E2E_SERVER_MODE', 'next-start');
  return (await import('../../playwright.config')).default;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Playwright CI evidence configuration', () => {
  it('retains failure media, a portable report, and server output for sanitization', async () => {
    const config = await loadCiConfig();

    expect(config.reporter).toEqual([
      ['github'],
      ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ]);
    expect(config.outputDir).toBe('test-results');
    expect(config.preserveOutput).toBe('always');
    expect(config.use).toMatchObject({
      screenshot: 'only-on-failure',
      trace: 'retain-on-failure',
      video: 'retain-on-failure',
    });
    expect(config.webServer).toMatchObject({
      name: 'Apple333 storefront',
      stdout: 'pipe',
      stderr: 'pipe',
    });
  });
});
