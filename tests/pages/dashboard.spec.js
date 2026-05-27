// @ts-check
const { test, expect } = require('@playwright/test');

// These tests require a running app with a connected MongoDB.
// They are skipped automatically in CI when SKIP_DB_TESTS=true.
test.describe('Dashboard page', () => {
  test.skip(!!process.env.SKIP_DB_TESTS, 'Skipped: requires DB');

  test('redirects / to /dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/dashboard/);
  });

  test('dashboard page responds with 200', async ({ page }) => {
    const res = await page.goto('/dashboard');
    expect(res.status()).toBe(200);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Project list page', () => {
  test.skip(!!process.env.SKIP_DB_TESTS, 'Skipped: requires DB');

  test('project-list page responds with 200', async ({ page }) => {
    const res = await page.goto('/projects/project-list');
    expect(res.status()).toBe(200);
    await expect(page.locator('body')).toBeVisible();
  });
});
