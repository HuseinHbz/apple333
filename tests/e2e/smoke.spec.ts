import { expect,test } from '@playwright/test';
test('enterprise home and health endpoint load',async({page,request})=>{await page.goto('/');await expect(page.getByRole('heading')).toContainText('Enterprise foundation');const health=await request.get('/api/health');expect(health.ok()).toBeTruthy();});
