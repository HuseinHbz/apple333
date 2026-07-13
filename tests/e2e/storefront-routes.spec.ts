import { expect, test } from '@playwright/test';

const storefrontRoutes = ['/', '/catalog', '/cart', '/checkout'] as const;

test.describe('public storefront route shells', () => {
  for (const route of storefrontRoutes) {
    test(`${route} renders without requiring seeded catalog data`, async ({ page }) => {
      const response = await page.goto(route);

      expect(response?.status(), `Expected ${route} to be a public storefront route.`).toBe(200);
      await expect(page.locator('main')).toBeVisible();
    });
  }
});
