import { expect, test } from '@playwright/test';

test('storefront home and health endpoint load', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /انتخاب دقیق‌تر/ })).toBeVisible();
  const health = await request.get('/api/health');
  expect(health.ok()).toBeTruthy();
});
