import { expect, test } from '@playwright/test';

test('unauthenticated visitors are redirected away from the admin platform', async ({ page, request }) => {
  await page.goto('/admin');

  await expect(page).toHaveURL(/\/account\/login/);
  await expect(page.getByRole('heading', { name: /Apple333/ })).toBeVisible();
  await expect(page.locator('input[name="email"][type="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"][type="password"]')).toBeVisible();

  const response = await request.get('/api/admin/users');
  const body = await response.json() as { success: boolean; error: { code: string } };
  expect(response.status()).toBe(401);
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(body).toMatchObject({ success: false, error: { code: 'UNAUTHENTICATED' } });
});

test('unauthenticated visitors cannot open Phase 04 PIM administration pages', async ({ page }) => {
  for (const route of ['/admin/products', '/admin/brands', '/admin/categories', '/admin/specifications', '/admin/warranties', '/admin/product-imports']) {
    await page.goto(route);
    await expect(page, `Expected ${route} to require an authenticated administrator.`).toHaveURL(/\/account\/login/);
  }
});
