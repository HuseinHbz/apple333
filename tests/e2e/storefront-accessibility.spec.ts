import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const storefrontPages = [
  ['home', '/'],
  ['catalog-search', '/products?query=e2e-iphone-16-pro'],
  ['product-detail', '/products/e2e-iphone-16-pro'],
  ['comparison', '/compare?slugs=e2e-iphone-16-pro%2Ce2e-iphone-16'],
  ['wishlist', '/wishlist'],
  ['cart', '/cart'],
] as const;

function violationsSummary(violations: readonly {
  id: string;
  impact: string | null;
  nodes: readonly Readonly<{ target: readonly string[]; failureSummary?: string }> [];
}[]) {
  return violations.map((violation) => `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.nodes.map((node) => `${node.target.join(' ')} ${node.failureSummary ?? ''}`).join(' | ')}`).join('; ');
}

test.describe('storefront WCAG automated checks', () => {
  for (const [name, path] of storefrontPages) {
    test(`${name} has no axe WCAG 2.2 A/AA violations`, async ({ page }, testInfo) => {
      await page.goto(path);
      await expect(page.locator('main:not([aria-busy])').last()).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      await testInfo.attach(`axe-${name}.json`, {
        body: JSON.stringify(results.violations, null, 2),
        contentType: 'application/json',
      });
      expect(violationsSummary(results.violations)).toBe('');
    });
  }

  test('mobile navigation exposes and closes its controlled menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const control = page.getByRole('button', { name: /navigation/ });
    await expect(control).toBeVisible();
    await expect(control).toHaveAttribute('aria-expanded', 'false');

    await control.click();
    await expect(control).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: /محصولات/ })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toHaveCount(0);
  });
});
