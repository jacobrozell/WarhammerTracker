import { test, expect } from '@playwright/test';
import {
  loadSampleData,
  expandArmy,
  unitRowLocator,
  unitStateSelect,
  squadToggle,
} from './helpers.js';

const UNIT = 'Brotherhood Terminators (5)';
const SOURCE = 'Combat Patrol 1';
const ARMY = 'Grey Knights';
const NOTE_SNIPPET = 'banner bearer';

test.describe('Unit row editing (sorted list)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadSampleData(page);
    await expandArmy(page, ARMY);
    await page.locator('#unitSort').selectOption('state');
  });

  test('state select updates the correct unit when sorted by state', async ({ page }) => {
    const row = unitRowLocator(page, UNIT, SOURCE);
    await unitStateSelect(row).selectOption('Primed');
    await expect(unitStateSelect(unitRowLocator(page, UNIT, SOURCE))).toHaveValue('Primed');
  });

  test('next-step button advances pipeline on the correct row', async ({ page }) => {
    const row = unitRowLocator(page, UNIT, SOURCE);
    await expect(unitStateSelect(row)).toHaveValue('Assembled');
    await row.locator('button[data-act="next"]').click();
    await expect(unitStateSelect(unitRowLocator(page, UNIT, SOURCE))).toHaveValue('Magnetising');
  });

  test('undo reverts a state change', async ({ page }) => {
    await unitStateSelect(unitRowLocator(page, UNIT, SOURCE)).selectOption('Primed');
    await expect(page.locator('#undoBtn')).toBeEnabled();
    await page.locator('#undoBtn').click();
    await expect(unitStateSelect(unitRowLocator(page, UNIT, SOURCE))).toHaveValue('Assembled');
  });

  test('duplicate adds a copy without affecting the original row state', async ({ page }) => {
    const before = await unitRowLocator(page, UNIT, SOURCE).count();
    await unitRowLocator(page, UNIT, SOURCE).locator('button[data-act="dup"]').click();
    await expect(unitRowLocator(page, UNIT, SOURCE)).toHaveCount(before + 1);
    await expect(unitStateSelect(unitRowLocator(page, UNIT, SOURCE).first())).toHaveValue('Assembled');
  });

  test('member state select works when squad is expanded', async ({ page }) => {
    const row = unitRowLocator(page, UNIT, SOURCE);
    await squadToggle(row).click();
    const unitIndex = await row.getAttribute('data-i');
    const memberRow = page.locator(
      `tr.member-row[data-army="${ARMY}"][data-i="${unitIndex}"][data-mi="2"]`,
    );
    await memberRow.locator('select[data-act="member-state"]').selectOption('Primed');
    await expect(memberRow.locator('select[data-act="member-state"]')).toHaveValue('Primed');
  });
});

test.describe('Unit editing with search active', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadSampleData(page);
    await expandArmy(page, ARMY);
    await page.locator('#search').fill(NOTE_SNIPPET);
    await page.waitForTimeout(250);
  });

  test('state change targets the searched unit row', async ({ page }) => {
    const row = unitRowLocator(page, UNIT, SOURCE);
    await expect(row).toHaveCount(1);
    await unitStateSelect(row).selectOption('Primed');
    await expect(unitStateSelect(row)).toHaveValue('Primed');
  });
});
