import { expect, test } from '@playwright/test';

const proProduct = 'Apple333 E2E iPhone 16 Pro';
const standardProduct = 'Apple333 E2E iPhone 16';

test.describe('seeded premium storefront flows', () => {
  test('renders a published PIM product detail with a sellable variant', async ({ page }) => {
    await page.goto('/products/e2e-iphone-16-pro');

    await expect(page.getByRole('heading', { name: proProduct })).toBeVisible();
    await expect(page.getByTestId('storefront-add-to-cart')).toBeEnabled();
  });

  test('searches the published PIM catalog through the public storefront flow', async ({ page }) => {
    await page.goto('/products');

    const search = page.getByTestId('storefront-search-input');
    await expect(search).toBeVisible();
    await search.fill('e2e-iphone-16-pro');

    await expect(page).toHaveURL(/query=e2e-iphone-16-pro/);
    await expect(page.getByRole('link', { name: proProduct })).toBeVisible();
  });

  test('compares two published PIM products', async ({ page }) => {
    await page.goto('/compare');

    await page.getByRole('button', { name: proProduct }).click();
    await page.getByRole('button', { name: standardProduct }).click();
    const apply = page.getByRole('button', { name: /مقایسه انتخاب‌ها/ });
    await expect(apply).toBeEnabled();
    await apply.click();

    await expect(page).toHaveURL(/e2e-iphone-16-pro.*e2e-iphone-16/);
    await expect(page.getByRole('table')).toContainText(proProduct);
    await expect(page.getByRole('table')).toContainText(standardProduct);
  });

  test('persists a guest wishlist in the browser without a customer database record', async ({ page }) => {
    await page.goto('/products/e2e-iphone-16-pro');

    const wishlist = page.locator('button[aria-pressed]').first();
    await expect(wishlist).toBeEnabled();
    await wishlist.click();
    await expect(wishlist).toHaveAttribute('aria-pressed', 'true');

    await page.goto('/wishlist');
    await expect(page.getByRole('link', { name: proProduct })).toBeVisible();
  });

  test('adds a sellable variant to the guest cart', async ({ page }) => {
    await page.goto('/products/e2e-iphone-16-pro');

    const addToCart = page.getByTestId('storefront-add-to-cart');
    await expect(addToCart).toBeEnabled();
    await Promise.all([
      page.waitForResponse((response) => response.url().includes('/api/store/cart/items') && response.request().method() === 'POST'),
      addToCart.click(),
    ]);

    await page.goto('/cart');
    await expect(page.getByRole('link', { name: proProduct })).toBeVisible();
  });
});
