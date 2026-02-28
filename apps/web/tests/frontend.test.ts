import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('http://localhost:3001');
  await expect(page).toHaveTitle(/HireClaw/);
});

test('login page loads', async ({ page }) => {
  await page.goto('http://localhost:3001/login');
  await expect(page.getByRole('heading', { name: 'Login to HireClaw' })).toBeVisible();
});

test('register page loads', async ({ page }) => {
  await page.goto('http://localhost:3001/register');
  await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
});
