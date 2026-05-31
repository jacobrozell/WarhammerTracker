import { headerMap, normalizeQty, emptyResult } from '../data/csv.js';
import { DEFAULT_PAINT_TYPES } from '../core/constants.js';
import { detectMusterPaints } from '../data/schema.js';

/** @param {string[][]} rows */
export function importMusterPaints(rows) {
  const hm = headerMap(rows, ['name']);
  if (!hm.ok) return { ...emptyResult(), errors: [hm.error] };

  const { col } = hm;
  const errors = [];
  const warnings = [];
  /** @type {import('../core/constants.js').Paint[]} */
  const data = [];

  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const name = (r[col('name')] || '').trim();
    if (!name) return;

    const type = (r[col('type')] || '').trim();
    const q = normalizeQty(r[col('quantity')]);
    if (q.warn) warnings.push(`Row ${line}: ${q.warn}`);

    data.push({
      name,
      type,
      swatch: DEFAULT_PAINT_TYPES[type] || '#777',
      qty: q.qty,
      brand: (r[col('brand')] || '').trim(),
      source: (r[col('source')] || '').trim(),
      notes: (r[col('notes')] || '').trim(),
    });
  });

  if (!data.length) errors.push('No paint rows found');
  if (errors.length) return { ...emptyResult(), errors, warnings };

  /** @type {Map<string, import('../core/constants.js').Paint>} */
  const merged = new Map();
  data.forEach(p => {
    const k = p.name.toLowerCase();
    const prev = merged.get(k);
    if (prev) {
      prev.qty = (prev.qty || 1) + (p.qty || 1);
      if (p.notes && !prev.notes) prev.notes = p.notes;
      warnings.push(`Merged duplicate paint "${p.name}"`);
    } else merged.set(k, p);
  });
  const out = [...merged.values()];

  return {
    ok: true,
    errors: [],
    warnings,
    stats: { paints: out.length },
    data: out,
  };
}

export const musterPaintsImporter = /** @type {import('./registry.js').Importer} */ ({
  id: 'muster-paints',
  label: 'Muster Roll Paints CSV',
  domain: 'paints',
  detect: detectMusterPaints,
  import: (rows) => importMusterPaints(rows),
});
