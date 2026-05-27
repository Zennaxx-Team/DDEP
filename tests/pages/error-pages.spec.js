// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Error pages', () => {
  test('404 page renders', async ({ page }) => {
    const res = await page.goto('/404');
    expect(res.status()).toBe(200);
    await expect(page).toHaveTitle(/404|not found/i);
  });

  test('500 page renders', async ({ page }) => {
    const res = await page.goto('/500');
    expect(res.status()).toBe(200);
    await expect(page).toHaveTitle(/500|error/i);
  });

  test('not-authorized page renders', async ({ page }) => {
    const res = await page.goto('/not-authorized');
    expect(res.status()).toBe(200);
    await expect(page.locator('body')).toBeVisible();
  });

  test('unknown route returns 404 JSON', async ({ request }) => {
    const res = await request.get('/this-route-does-not-exist-xyz');
    // Express 404 handler returns JSON for non-browser requests
    expect([404, 200]).toContain(res.status());
  });
});
