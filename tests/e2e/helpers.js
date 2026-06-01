/** @param {import('@playwright/test').Page} page */
export async function dismissBlockingDialogs(page) {
  const confirm = page.locator('.confirm-dialog');
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.locator('button[value="cancel"]').click();
    await confirm.waitFor({ state: 'hidden' });
  }
  const modal = page.locator('#importModal');
  while (await modal.isVisible().catch(() => false)) {
    await page.locator('#importModalOk').click();
    await modal.waitFor({ state: 'hidden' });
  }
}

/** @param {import('@playwright/test').Page} page */
export async function loadSampleData(page) {
  await dismissBlockingDialogs(page);
  if (await page.locator('#armies .army').count()) return;

  await page.getByRole('button', { name: /Sample data/i }).click();

  for (let step = 0; step < 8; step++) {
    const confirm = page.locator('.confirm-dialog');
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.locator('button[value="ok"]').click();
      await confirm.waitFor({ state: 'hidden' });
      continue;
    }
    const modal = page.locator('#importModal');
    if (await modal.isVisible().catch(() => false)) {
      await page.locator('#importModalOk').click();
      await modal.waitFor({ state: 'hidden' });
      continue;
    }
    if (await page.locator('#armies .army').count()) break;
    await page.waitForTimeout(150);
  }

  await dismissBlockingDialogs(page);
  await page.locator('#armies .army').first().waitFor({ state: 'visible', timeout: 10_000 });
}

/** @param {import('@playwright/test').Page} page */
export async function goToArmiesTab(page) {
  await page.getByRole('tab', { name: /Armies/i }).click();
  await page.locator('.tab[data-tab="armies"].on').waitFor({ state: 'visible' });
}

/** @param {import('@playwright/test').Page} page */
export async function goToPaintsTab(page) {
  await page.getByRole('tab', { name: /Paint Rack/i }).click();
  await page.locator('.tab[data-tab="paints"].on').waitFor({ state: 'visible' });
}

/** @param {import('@playwright/test').Page} page @param {string} armyName */
export async function expandArmy(page, armyName) {
  const army = page.locator(`.army[data-army="${armyName}"]`);
  const collapsed = await army.evaluate(el => el.classList.contains('collapsed'));
  if (collapsed) await army.locator('.army-head').click();
  return army;
}

/** @param {import('@playwright/test').Page} page */
export async function waitForArmySearch(page) {
  await page.waitForTimeout(250);
}

/** @param {import('@playwright/test').Page} page */
export async function waitForPaintSearch(page) {
  await page.waitForTimeout(250);
}

/** @param {import('@playwright/test').Page} page */
export async function saveFormDialog(page) {
  await page.locator('#importModalOk').click();
  await page.locator('#importModal').waitFor({ state: 'hidden' });
}

/** @param {import('@playwright/test').Page} page */
export async function confirmOk(page) {
  await page.locator('.confirm-dialog button[value="ok"]').click();
  await page.locator('.confirm-dialog').waitFor({ state: 'hidden' });
}

/** @param {string} s */
function attrValue(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} unitName
 * @param {string} [source]
 */
export function unitRowLocator(page, unitName, source) {
  let sel = `tr[data-army]:not(.member-row):has(input.unit-name-in[value="${attrValue(unitName)}"])`;
  if (source) sel += `:has(input.src-in[value="${attrValue(source)}"])`;
  return page.locator(sel);
}

/** @param {import('@playwright/test').Locator} unitRow */
export function squadToggle(unitRow) {
  return unitRow.locator('button[data-act="squad-toggle"]');
}

/** @param {import('@playwright/test').Locator} unitRow */
export function unitStateSelect(unitRow) {
  return unitRow.locator('select[data-act="state"]');
}

/** @param {import('@playwright/test').Page} page @param {string} paintName */
export function paintCard(page, paintName) {
  return page.locator(`.paint[data-name="${attrValue(paintName)}"]`);
}
