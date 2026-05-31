import { parseCSV, serializeCSV, downloadText } from '../data/csv.js';
import { ARMY_SCHEMA, PAINT_SCHEMA } from '../data/schema.js';
import { runImport } from './registry.js';
import { getState, getPipeline, getFactionPresets, setCollection, setPaints, exportSnapshot } from '../core/store.js';
import { showImportResult } from '../ui/modal.js';
import { toast } from '../ui/toast.js';

/** @param {import('../data/csv.js').ImportResult} result @param {'armies'|'paints'} domain */
function applyImport(result, domain) {
  if (!result.ok || !result.data) return false;
  if (domain === 'armies') setCollection(/** @type {import('../core/constants.js').Army[]} */ (result.data));
  else setPaints(/** @type {import('../core/constants.js').Paint[]} */ (result.data));
  return true;
}

/** @param {import('../data/csv.js').ImportResult} result */
function resultTitle(result, domain) {
  if (!result.ok) return 'Import failed';
  return domain === 'armies' ? 'Armies imported' : 'Paints imported';
}

/** @param {string} text @param {'armies'|'paints'} expected */
export function processCSVText(text, expected) {
  const rows = parseCSV(text);
  const ctx = { pipeline: getPipeline(), factionPresets: getFactionPresets() };
  const result = runImport(rows, ctx, expected);

  if (result.ok) applyImport(result, expected);
  showImportResult(resultTitle(result, expected), result);
}

/** @param {File} file @param {'armies'|'paints'} expected */
export function handleImportFile(file, expected) {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => processCSVText(/** @type {string} */ (fr.result), expected);
  fr.onerror = () => showImportResult('Import failed', {
    ok: false, errors: ['Could not read file'], warnings: [], stats: {},
  });
  fr.readAsText(file);
}

/** @param {'armies'|'paints'} kind */
export function downloadTemplate(kind) {
  const schema = kind === 'armies' ? ARMY_SCHEMA : PAINT_SCHEMA;
  downloadText(schema.template, schema.filename);
  toast('Template downloaded');
}

export function exportArmiesCSV() {
  const { collection } = getState();
  const rows = [ARMY_SCHEMA.exportHeaders];
  collection.forEach(a => {
    a.units.forEach(u => {
      rows.push([
        a.game, a.faction, a.army, u.unit, u.qty || 1, u.source || '',
        u.state,
        u.spearhead === undefined ? '' : (u.spearhead ? 'Yes' : 'No'),
        u.notes || '',
      ]);
    });
  });
  downloadText(serializeCSV(rows), ARMY_SCHEMA.filename);
  toast('Exported');
}

export function exportPaintsCSV() {
  const { paints } = getState();
  const rows = [PAINT_SCHEMA.exportHeaders];
  paints.forEach(p => {
    rows.push([p.name, p.type, p.brand || '', p.source || '', p.qty || 1, p.notes || '']);
  });
  downloadText(serializeCSV(rows), PAINT_SCHEMA.filename);
  toast('Exported');
}

/** Full JSON backup — future cloud sync hook (future_ideas #4) */
export function exportJSONBackup() {
  downloadText(exportSnapshot(), 'muster-roll-backup.json', 'application/json');
  toast('Backup exported');
}
