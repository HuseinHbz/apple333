import { expect, test } from '@playwright/test';

test('unauthenticated visitors are redirected away from the admin platform', async ({ page, request }) => {
  await page.goto('/admin');

  await expect(page).toHaveURL(/\/account\/login/);
  await expect(page.getByRole('heading', { name: 'ورود به مدیریت' })).toBeVisible();
  await expect(page.getByLabel('ایمیل سازمانی')).toBeVisible();
  await expect(page.getByLabel('گذرواژه')).toBeVisible();

  const response = await request.get('/api/admin/users');
  const body = await response.json() as { success: boolean; error: { code: string } };
  expect(response.status()).toBe(401);
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(body).toMatchObject({ success: false, error: { code: 'UNAUTHENTICATED' } });
});
