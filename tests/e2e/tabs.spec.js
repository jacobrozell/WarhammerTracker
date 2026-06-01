import { test, expect } from '@playwright/test';
import { loadSampleData, goToArmiesTab, goToPaintsTab } from './helpers.js';

test.describe('Tabs and keyboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadSampleData(page);
  });

  test('switches between armies and paint rack', async ({ page }) => {
    await expect(page.locator('#tab-armies')).toBeVisible();
    await goToPaintsTab(page);
    await expect(page.locator('#tab-paints')).toBeVisible();
    await expect(page.locator('#paints .paint').first()).toBeVisible();
    await goToArmiesTab(page);
    await expect(page.locator('#armies .army').first()).toBeVisible();
  });

  test('hash #paints opens paint tab on load', async ({ page }) => {
    await page.goto('/#paints');
    await expect(page.locator('.tab[data-tab="paints"].on')).toBeVisible();
    await expect(page.locator('#tab-paints')).toBeVisible();
    await expect(page.locator('#paints .paint').first()).toBeVisible();
  });

  test('slash focuses search on the active tab', async ({ page }) => {
    await page.keyboard.press('/');
    await expect(page.locator('#search')).toBeFocused();
    await goToPaintsTab(page);
    await page.locator('#paintSearch').blur();
    await page.keyboard.press('/');
    await expect(page.locator('#paintSearch')).toBeFocused();
  });
});
