import { expect, test } from '@playwright/test';

test('catalog route exposes the public storefront shell', async ({ page }) => {
  const response = await page.goto('/products');
  expect(response?.status()).toBe(200);
  await expect(page.locator('main')).toBeVisible();
});

test('comparison route is publicly reachable', async ({ page }) => {
  const response = await page.goto('/compare');
  expect(response?.status()).toBe(200);
  await expect(page.locator('main')).toBeVisible();
});

test('guest wishlist route renders without customer persistence', async ({ page }) => {
  const response = await page.goto('/wishlist');
  expect(response?.status()).toBe(200);
  await expect(page.locator('main')).toBeVisible();
});

test('account foundation route does not require the admin login', async ({ page }) => {
  const response = await page.goto('/account');
  expect(response?.status()).toBe(200);
  await expect(page.locator('main')).toBeVisible();
});

test('category discovery route is available without colliding with product slugs', async ({ page }) => {
  const response = await page.goto('/categories/iphone');
  expect(response?.status()).toBe(200);
  await expect(page.locator('main')).toBeVisible();
});

test('storefront supplies a keyboard skip link', async ({ page }) => {
  await page.goto('/wishlist');
  const skip = page.locator('a[href="#storefront-content"]');
  await expect(skip).toHaveCount(1);
  await skip.focus();
  await expect(skip).toBeVisible();
});

test('robots disallows private storefront areas from indexing', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.ok()).toBeTruthy();
  await expect(response.text()).resolves.toContain('Disallow: /wishlist/');
});
