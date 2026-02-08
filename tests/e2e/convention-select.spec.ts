import { test, expect } from '@playwright/test';

test('app loads and renders main content area', async ({ page }) => {
  await page.goto('/');
  const main = page.locator('main');
  await expect(main).toBeVisible();
});

test('app renders a heading and description', async ({ page }) => {
  await page.goto('/');
  const heading = page.locator('h1');
  await expect(heading).toBeVisible();
  const description = page.locator('main p');
  await expect(description).toBeVisible();
});
