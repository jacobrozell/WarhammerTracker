import { test, expect } from '@playwright/test';
import {
  loadSampleData,
  goToPaintsTab,
  paintCard,
  saveFormDialog,
  waitForPaintSearch,
} from './helpers.js';

test.describe('Paint rack', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadSampleData(page);
    await goToPaintsTab(page);
  });

  test('search filters paint cards', async ({ page }) => {
    await page.locator('#paintSearch').fill('Khorne');
    await waitForPaintSearch(page);
    await expect(paintCard(page, 'Khorne Red')).toBeVisible();
    await expect(page.locator('#paints .paint')).toHaveCount(1);
  });

  test('type chip filters paints', async ({ page }) => {
    await page.locator('#paintFilters .chip[data-t="Shade"]').click();
    await expect(paintCard(page, 'Agrax Earthshade')).toBeVisible();
    await expect(paintCard(page, 'Khorne Red')).toHaveCount(0);
  });

  test('edit paint saves quantity from modal', async ({ page }) => {
    await paintCard(page, 'Khorne Red').locator('.paint-edit').click();
    await expect(page.locator('#importModalTitle')).toHaveText('Edit paint');
    await page.locator('#dynForm input[name="qty"]').fill('3');
    await saveFormDialog(page);
    await expect(paintCard(page, 'Khorne Red').locator('.qbadge')).toHaveText('×3');
  });

  test('clear filters restores full paint list', async ({ page }) => {
    await page.locator('#paintSearch').fill('zzznomatch');
    await waitForPaintSearch(page);
    await expect(page.locator('#paints .paint')).toHaveCount(0);
    await page.locator('#clearPaintFilters').click();
    await expect(page.locator('#paints .paint').first()).toBeVisible();
  });
});
