import { test, expect } from '@playwright/test';
import {
  loadSampleData,
  expandArmy,
  unitRowLocator,
  unitStateSelect,
  waitForArmySearch,
} from './helpers.js';

const ARMY_GK = 'Grey Knights';
const UNIT = 'Brotherhood Terminators (5)';
const SOURCE = 'Combat Patrol 1';

test.describe('Army list filters and layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadSampleData(page);
  });

  test('game filter hides armies from other games', async ({ page }) => {
    await page.locator('#filters .chip[data-g="40k"]').click();
    await expect(page.locator(`.army[data-army="${ARMY_GK}"]`)).toBeVisible();
    await expect(page.locator('.army[data-army="Vermindoom"]')).toHaveCount(0);
  });

  test('source filter from paint rack switches tab and filters armies', async ({ page }) => {
    await page.getByRole('tab', { name: /Paint Rack/i }).click();
    await page.locator('.paint[data-name="Khorne Red"] .paint-link').click();
    await expect(page.locator('.tab[data-tab="armies"].on')).toBeVisible();
    await expect(page.locator('#sourceFilter')).toHaveValue('Skaven Painting Kit');
    await expect(page.locator('.army[data-army="Vermindoom"]')).toBeVisible();
  });

  test('collapse and expand army preserves unit rows', async ({ page }) => {
    const army = page.locator(`.army[data-army="${ARMY_GK}"]`);
    await expandArmy(page, ARMY_GK);
    await army.locator('.army-head').click();
    await expect(army).toHaveClass(/collapsed/);
    await army.locator('.army-head').click();
    await expect(unitRowLocator(page, UNIT, SOURCE)).toBeVisible();
  });

  test('collapse all then expand all restores armies', async ({ page }) => {
    await page.getByRole('button', { name: 'Collapse', exact: true }).click();
    await expect(page.locator('.army.collapsed')).not.toHaveCount(0);
    await page.getByRole('button', { name: 'Expand', exact: true }).click();
    await expandArmy(page, ARMY_GK);
    await expect(unitRowLocator(page, UNIT, SOURCE)).toBeVisible();
  });

  test('advance visible advances only units in the current view', async ({ page }) => {
    await expandArmy(page, ARMY_GK);
    await page.locator('#search').fill('Includes banner bearer');
    await waitForArmySearch(page);
    const row = unitRowLocator(page, UNIT, SOURCE);
    await expect(unitStateSelect(row)).toHaveValue('Assembled');
    await page.getByRole('button', { name: /Advance visible/i }).click();
    await expect(unitStateSelect(row)).toHaveValue('Magnetising');
    await expect(page.locator('#undoBtn')).toBeEnabled();
  });

  test('spearhead toggle updates the row', async ({ page }) => {
    await expandArmy(page, 'Vermindoom');
    const row = unitRowLocator(page, 'Clanrats (5)', 'Skaventide').first();
    const spear = row.locator('button[data-act="spear"]');
    await expect(spear.locator('.spear')).toBeVisible();
    await spear.click();
    await expect(spear.locator('.spear-no')).toBeVisible();
  });
});
