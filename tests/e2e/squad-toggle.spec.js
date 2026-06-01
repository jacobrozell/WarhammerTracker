import { test, expect } from '@playwright/test';
import { loadSampleData, expandArmy, unitRowLocator, squadToggle } from './helpers.js';

const UNIT = 'Brotherhood Terminators (5)';
const SOURCE = 'Combat Patrol 1';
const ARMY = 'Grey Knights';

test.describe('Squad per-model toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadSampleData(page);
    await expandArmy(page, ARMY);
  });

  test('enables per-model rows on first click (default name sort)', async ({ page }) => {
    const row = unitRowLocator(page, UNIT, SOURCE);
    const toggle = squadToggle(row);

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();

    await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 5_000 });
    await expect(row.locator('~ tr.member-row')).toHaveCount(5);
  });

  test('collapses and re-expands member rows', async ({ page }) => {
    const row = unitRowLocator(page, UNIT, SOURCE);
    const toggle = squadToggle(row);

    await toggle.click();
    await expect(row.locator('~ tr.member-row')).toHaveCount(5);

    await toggle.click();
    await expect(row.locator('~ tr.member-row')).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await expect(row.locator('~ tr.member-row')).toHaveCount(5);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('works on first click when units are sorted by state', async ({ page }) => {
    await page.locator('#unitSort').selectOption('state');
    const row = unitRowLocator(page, UNIT, SOURCE);
    const toggle = squadToggle(row);

    await toggle.click();
    await expect(row.locator('~ tr.member-row')).toHaveCount(5, { timeout: 5_000 });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('squad-off removes per-model tracking', async ({ page }) => {
    const row = unitRowLocator(page, UNIT, SOURCE);
    await squadToggle(row).click();
    await expect(row.locator('~ tr.member-row')).toHaveCount(5);

    await row.locator('button[data-act="squad-off"]').click();
    await expect(row.locator('~ tr.member-row')).toHaveCount(0);
    await expect(squadToggle(row)).toHaveCount(1);
  });
});
