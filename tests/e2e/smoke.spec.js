import { test, expect } from '@playwright/test';
import { loadSampleData } from './helpers.js';

test.describe('The Muster Roll', () => {
  test('loads and shows armies tab', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Muster Roll/i);
    await expect(page.getByRole('tab', { name: /Armies/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The Muster Roll' })).toBeVisible();
  });

  test('loads sample data and renders armies', async ({ page }) => {
    await page.goto('/');
    await loadSampleData(page);
    await expect(page.locator('#armies .army')).not.toHaveCount(0, { timeout: 10_000 });
    await expect(page.locator('#overallPct')).not.toHaveText('0%');
  });

  test('switches to paint rack tab', async ({ page }) => {
    await page.goto('/');
    await loadSampleData(page);
    await page.getByRole('tab', { name: /Paint Rack/i }).click();
    await expect(page.locator('#paints .paint')).not.toHaveCount(0, { timeout: 10_000 });
  });
});
