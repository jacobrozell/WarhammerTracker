import { headerMap, normalizeQty, normalizeBool, emptyResult } from '../data/csv.js';
import { DEFAULT_FACTION_PRESETS } from '../core/constants.js';
import { normalizeState } from '../core/pipeline.js';
import { detectMusterArmies } from '../data/schema.js';

/**
 * @param {string[][]} rows
 * @param {{ pipeline: import('../core/constants.js').PipelineStage[], factionPresets?: Record<string,[string,string]>|null }} ctx
 */
export function importMusterArmies(rows, ctx) {
  const hm = headerMap(rows, ['game', 'faction', 'army', 'unit']);
  if (!hm.ok) return { ...emptyResult(), errors: [hm.error] };

  const { col } = hm;
  const presets = ctx.factionPresets || DEFAULT_FACTION_PRESETS;
  const errors = [];
  const warnings = [];
  const order = [];
  /** @type {Record<string, import('../core/constants.js').Army>} */
  const map = {};

  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const army = (r[col('army')] || '').trim();
    const unit = (r[col('unit')] || '').trim();
    if (!army && !unit) return;
    if (!army) { errors.push(`Row ${line}: missing Army`); return; }
    if (!unit) { errors.push(`Row ${line}: missing Unit`); return; }

    const game = (r[col('game')] || '').trim();
    const faction = (r[col('faction')] || '').trim();
    if (!game) warnings.push(`Row ${line}: missing Game`);
    if (!faction) warnings.push(`Row ${line}: missing Faction`);

    if (!map[army]) {
      map[army] = { army, game, faction, units: [] };
      order.push(army);
    } else {
      if (game && map[army].game && map[army].game !== game) {
        warnings.push(`Row ${line}: Game "${game}" differs from first row for army "${army}"`);
      }
      if (faction && map[army].faction && map[army].faction !== faction) {
        warnings.push(`Row ${line}: Faction "${faction}" differs from first row for army "${army}"`);
      }
    }

    const q = normalizeQty(r[col('qty')]);
    if (q.warn) warnings.push(`Row ${line}: ${q.warn}`);
    const st = normalizeState(r[col('state')], ctx.pipeline);
    if (st.warn) warnings.push(`Row ${line}: ${st.warn}`);

    /** @type {Record<string, unknown>} */
    const u = {
      unit,
      qty: q.qty,
      source: (r[col('source')] || '').trim(),
      state: st.state,
    };

    const sp = normalizeBool(r[col('spearhead')]);
    if (sp.warn) warnings.push(`Row ${line}: ${sp.warn}`);
    if (sp.val !== undefined) u.spearhead = sp.val;

    const nt = (r[col('notes')] || '').trim();
    if (nt) u.notes = nt;

    map[army].units.push(u);
  });

  if (!order.length) errors.push('No unit rows found');
  if (errors.length) return { ...emptyResult(), errors, warnings };

  const data = order.map(a => {
    const o = map[a];
    const f = presets[o.faction] || [o.faction.slice(0, 2).toUpperCase() || '??', '#888'];
    return { ...o, crest: f[0], color: f[1] };
  });

  return {
    ok: true,
    errors: [],
    warnings,
    stats: { armies: data.length, units: data.reduce((s, a) => s + a.units.length, 0) },
    data,
  };
}

export const musterArmiesImporter = {
  id: 'muster-armies',
  label: 'Muster Roll Armies CSV',
  domain: 'armies',
  detect: detectMusterArmies,
  import: importMusterArmies,
};
