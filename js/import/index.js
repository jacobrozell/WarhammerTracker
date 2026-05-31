import { parseCSV, serializeCSV, downloadText, fileImportHint } from '../data/csv.js';
import { MAX_IMPORT_BYTES } from '../core/limits.js';
import { ARMY_SCHEMA, PAINT_SCHEMA } from '../data/schema.js';
import { runImport } from './registry.js';
import { getArmyPresentation } from '../data/faction-presets.js';
import {
  getState,
  getPipeline,
  getFactionPresets,
  setCollection,
  setPaints,
  appendCollection,
  appendPaints,
  exportSnapshot,
  importSnapshot,
  previewBackup,
  recordBackup,
} from '../core/store.js';
import { showImportResult } from '../ui/modal.js';
import { confirmDialog, importModeDialog } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';

/** @param {import('../data/csv.js').ImportResult} result @param {'armies'|'paints'} domain */
function applyImport(result, domain, mode) {
  if (!result.ok || !result.data) return false;
  if (mode === 'append') {
    if (domain === 'armies') appendCollection(/** @type {import('../core/constants.js').Army[]} */ (result.data));
    else appendPaints(/** @type {import('../core/constants.js').Paint[]} */ (result.data));
  } else if (domain === 'armies') {
    setCollection(/** @type {import('../core/constants.js').Army[]} */ (result.data));
  } else {
    setPaints(/** @type {import('../core/constants.js').Paint[]} */ (result.data));
  }
  return true;
}

/** @param {import('../data/csv.js').ImportResult} result @param {'armies'|'paints'} domain */
function resultTitle(result, domain) {
  if (!result.ok) return 'Import failed';
  return domain === 'armies' ? 'Armies imported' : 'Paints imported';
}

/** @param {'armies'|'paints'} domain */
function existingSummary(domain) {
  const { collection, paints } = getState();
  if (domain === 'armies') {
    const units = collection.reduce((s, a) => s + a.units.length, 0);
    return { count: collection.length, detail: `${collection.length} armies (${units} unit entries)` };
  }
  return { count: paints.length, detail: `${paints.length} paints` };
}

/** @param {import('../data/csv.js').ImportResult} result @param {'armies'|'paints'} domain */
function incomingSummary(result, domain) {
  if (domain === 'armies') {
    return `${result.stats.armies} armies (${result.stats.units} unit entries)`;
  }
  return `${result.stats.paints} paints`;
}

/** @param {import('../data/csv.js').ImportResult} result @param {'armies'|'paints'} domain @param {'replace'|'append'} mode */
async function confirmImport(result, domain, mode) {
  const existing = existingSummary(domain);
  const incoming = incomingSummary(result, domain);
  const preview = `Preview: ${incoming}${result.warnings.length ? ` (${result.warnings.length} warnings)` : ''}.`;
  if (!existing.count) return true;
  if (mode === 'append') {
    return confirmDialog(
      `${preview}\n\nAppend to your current ${domain} data (${existing.detail})?`,
      { okLabel: 'Append' }
    );
  }
  return confirmDialog(
    `${preview}\n\nReplace your current ${domain} data (${existing.detail})?\n\nExport first if you need a backup.`,
    { okLabel: 'Replace', danger: true }
  );
}

/** @param {string} text @param {'armies'|'paints'} expected @param {'replace'|'append'} [mode] */
export async function processCSVText(text, expected, mode = 'replace') {
  const rows = parseCSV(text);
  const ctx = { pipeline: getPipeline(), factionPresets: getFactionPresets() };
  const result = runImport(rows, ctx, expected);

  if (result.ok) {
    if (!await confirmImport(result, expected, mode)) {
      toast('Import cancelled');
      return;
    }
    const replaced = mode === 'replace' ? existingSummary(expected) : null;
    applyImport(result, expected, mode);
    if (replaced?.count) result.replaced = replaced.detail;
  }
  showImportResult(resultTitle(result, expected), result);
}

/** @param {File} file */
function fileSizeError(file) {
  if (file.size > MAX_IMPORT_BYTES) {
    const mb = Math.round(MAX_IMPORT_BYTES / (1024 * 1024));
    return `File is too large (max ${mb} MB). Split the CSV or remove unused rows.`;
  }
  return null;
}

/** @param {File} file @param {'armies'|'paints'} expected @param {'replace'|'append'} [mode] */
export async function handleImportFile(file, expected, mode) {
  if (!file) return;
  const sizeErr = fileSizeError(file);
  if (sizeErr) {
    showImportResult('Import failed', { ok: false, errors: [sizeErr], warnings: [], stats: {} });
    return;
  }
  const hint = fileImportHint(file.name);
  if (hint) {
    showImportResult('Import failed', { ok: false, errors: [hint], warnings: [], stats: {} });
    return;
  }
  let importMode = /** @type {'replace'|'append'|undefined} */ (mode);
  if (!importMode) {
    const { collection, paints } = getState();
    const hasExisting = expected === 'armies' ? collection.length > 0 : paints.length > 0;
    if (hasExisting) {
      const choice = await importModeDialog(
        `Import ${file.name} as ${expected}?\n\nReplace clears current data; Append adds rows.`
      );
      if (choice === 'cancel') {
        toast('Import cancelled');
        return;
      }
      importMode = choice;
    } else {
      importMode = 'replace';
    }
  }
  const fr = new FileReader();
  fr.onload = () => processCSVText(/** @type {string} */ (fr.result), expected, importMode);
  fr.onerror = () => showImportResult('Import failed', {
    ok: false, errors: ['Could not read file'], warnings: [], stats: {},
  });
  fr.readAsText(file);
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

export function exportArmiesCSV() {
  const { collection, settings } = getState();
  const rows = [ARMY_SCHEMA.exportHeaders];
  collection.forEach(a => {
    const { crest, color } = getArmyPresentation(a, settings.factionPresets);
    a.units.forEach(u => {
      rows.push([
        a.game, a.faction, a.army, u.unit, u.qty || 1, u.source || '',
        u.state,
        u.spearhead === undefined ? '' : (u.spearhead ? 'Yes' : 'No'),
        u.notes || '',
        crest,
        color,
      ]);
    });
  });
  downloadText(serializeCSV(rows), `warhammer_armies_${stamp()}.csv`);
  toast('Armies exported — use Full backup for pipeline, theme & filters', 3500);
}

export function exportPaintsCSV() {
  const { paints } = getState();
  const rows = [PAINT_SCHEMA.exportHeaders];
  paints.forEach(p => {
    rows.push([p.name, p.type, p.brand || '', p.source || '', String(p.qty || 1), p.notes || '']);
  });
  downloadText(serializeCSV(rows), `warhammer_paint_inventory_${stamp()}.csv`);
  toast('Exported');
}

export function exportJSONBackup() {
  downloadText(exportSnapshot(), `muster-roll-backup-${stamp()}.json`, 'application/json');
  recordBackup();
  toast('Backup exported (includes settings)');
}

/** @param {File} file */
export async function importJSONBackup(file) {
  if (!file) return;
  const sizeErr = fileSizeError(file);
  if (sizeErr) {
    toast(sizeErr, 4000);
    return;
  }
  const { collection, paints } = getState();
  const hasData = collection.length > 0 || paints.length > 0;
  const fr = new FileReader();
  fr.onload = async () => {
    const text = /** @type {string} */ (fr.result);
    const preview = previewBackup(text, { byteLength: file.size });
    if (!preview.ok) {
      toast(preview.error, 4000);
      return;
    }
    const msg = hasData
      ? `Restore backup?\n\nPreview: ${preview.preview}\n\nThis replaces all armies, paints, and settings.`
      : `Restore backup?\n\nPreview: ${preview.preview}`;
    if (hasData && !await confirmDialog(msg, { okLabel: 'Restore', danger: true })) {
      toast('Restore cancelled');
      return;
    }
    if (!hasData && !await confirmDialog(msg, { okLabel: 'Restore' })) {
      toast('Restore cancelled');
      return;
    }
    if (importSnapshot(text, { byteLength: file.size })) toast('Backup restored');
  };
  fr.onerror = () => toast('Could not read backup file');
  fr.readAsText(file);
}
