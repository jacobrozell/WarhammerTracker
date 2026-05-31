import { headerMap, normalizeQty, normalizeBool, emptyResult } from '../data/csv.js';
import { resolveFactionPreset, isFallbackPreset } from '../data/faction-presets.js';
import { safeColor } from '../core/dom.js';
import { normalizeState } from '../core/pipeline.js';
import { detectMusterArmies } from '../data/schema.js';
import {
  squadGroupKey,
  ensureSquadMembers,
  setMember,
  squadSize,
} from '../core/members.js';

/** @param {string[][]} rows @param {(n: string) => number} col @param {string} name */
function optionalCol(rows, col, name) {
  const i = col(name);
  return i >= 0 ? i : -1;
}

/**
 * @param {string[][]} rows
 * @param {{ pipeline: import('../core/constants.js').PipelineStage[], factionPresets?: Record<string,[string,string]>|null }} ctx
 */
export function importMusterArmies(rows, ctx) {
  const hm = headerMap(rows, ['game', 'faction', 'army', 'unit']);
  if (!hm.ok) return { ...emptyResult(), errors: [hm.error] };

  const { col } = hm;
  const crestCol = optionalCol(rows, col, 'crest');
  const colorCol = optionalCol(rows, col, 'color');
  const memberCol = optionalCol(rows, col, 'member');
  const memberStateCol = optionalCol(rows, col, 'memberstate');
  const memberNotesCol = optionalCol(rows, col, 'membernotes');
  const errors = [];
  const warnings = [];
  const order = [];
  /** @type {Record<string, { army: string, game: string, faction: string, units: object[], _csvCrest?: string, _csvColor?: string }>} */
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
      if (crestCol >= 0) {
        const c = (r[crestCol] || '').trim();
        if (c) map[army]._csvCrest = c.slice(0, 8);
      }
      if (colorCol >= 0) {
        const c = (r[colorCol] || '').trim();
        if (c) map[army]._csvColor = c;
      }
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

    const memberRaw = memberCol >= 0 ? (r[memberCol] || '').trim() : '';
    const memberNum = memberRaw ? parseInt(memberRaw, 10) : NaN;

    if (memberCol >= 0 && memberRaw && (!Number.isFinite(memberNum) || memberNum < 1)) {
      warnings.push(`Row ${line}: invalid Member "${memberRaw}" — skipping member data`);
      map[army].units.push(u);
      return;
    }

    if (memberCol >= 0 && Number.isFinite(memberNum) && memberNum >= 1) {
      let existing = map[army].units.find(x => squadGroupKey(x, u));
      if (!existing) {
        existing = u;
        map[army].units.push(existing);
      }
      ensureSquadMembers(existing);
      const max = squadSize(existing);
      if (memberNum > max) {
        warnings.push(`Row ${line}: Member ${memberNum} exceeds squad size (${max})`);
      } else {
        /** @type {{ state?: string, notes?: string }} */
        const patch = {};
        if (memberStateCol >= 0) {
          const rawMs = (r[memberStateCol] || '').trim();
          if (rawMs) {
            const ms = normalizeState(rawMs, ctx.pipeline);
            if (ms.warn) warnings.push(`Row ${line}: ${ms.warn}`);
            patch.state = ms.state;
          }
        }
        if (memberNotesCol >= 0) {
          const mn = (r[memberNotesCol] || '').trim();
          if (mn) patch.notes = mn;
        }
        setMember(existing, memberNum - 1, patch);
      }
      return;
    }

    map[army].units.push(u);
  });

  if (!order.length) errors.push('No unit rows found');
  if (errors.length) return { ...emptyResult(), errors, warnings };

  const warnedFactions = new Set();
  const data = order.map(a => {
    const o = map[a];
    const f = resolveFactionPreset(o.faction, { game: o.game, presets: ctx.factionPresets });
    const key = `${o.game || ''}\0${o.faction || ''}`;
    if (o.faction && isFallbackPreset(f) && !warnedFactions.has(key)) {
      warnedFactions.add(key);
      const scope = o.game ? ` for game "${o.game}"` : '';
      warnings.push(`Unknown faction "${o.faction}"${scope} — using default grey crest`);
    }

    const crest = o._csvCrest || f[0];
    const color = o._csvColor ? safeColor(o._csvColor) : f[1];
    if (o._csvColor && !/^#[0-9a-fA-F]{3,8}$/i.test(o._csvColor.trim())) {
      warnings.push(`Army "${o.army}": invalid Color "${o._csvColor}" — using preset`);
    }

    /** @type {import('../core/constants.js').Army} */
    const army = {
      army: o.army,
      game: o.game,
      faction: o.faction,
      crest,
      color,
      units: o.units,
    };
    if (o._csvCrest) army.crestOverride = o._csvCrest;
    if (o._csvColor) army.colorOverride = safeColor(o._csvColor);

    return army;
  });

  return {
    ok: true,
    errors: [],
    warnings,
    stats: { armies: data.length, units: data.reduce((s, a) => s + a.units.length, 0) },
    data,
  };
}

export const musterArmiesImporter = /** @type {import('./registry.js').Importer} */ ({
  id: 'muster-armies',
  label: 'Muster Roll Armies CSV',
  domain: 'armies',
  detect: detectMusterArmies,
  import: importMusterArmies,
});
