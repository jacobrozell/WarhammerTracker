import { APP_VERSION, DEFAULT_SETTINGS } from '../core/constants.js';
import { safeColor } from '../core/dom.js';
import {
  MAX_ARMIES,
  MAX_PAINTS,
  MAX_UNITS_PER_ARMY,
  MAX_UNITS_TOTAL,
  MAX_STRING_LEN,
  MAX_NOTES_LEN,
  MAX_IMPORT_BYTES,
} from '../core/limits.js';

const BACKUP_KEYS = new Set(['version', 'collection', 'paints', 'settings', 'exportedAt']);
const THEMES = new Set(['dark', 'light', 'system']);

/** @param {unknown} v @param {number} max */
function capStr(v, max) {
  return String(v ?? '').slice(0, max);
}

/** @param {import('../core/constants.js').AppState} state */
export function backupPreview(state) {
  const units = state.collection.reduce((s, a) => s + (a.units?.length || 0), 0);
  return `${state.collection.length} armies (${units} unit entries), ${state.paints.length} paints`;
}

/** @param {import('../core/constants.js').AppState} state */
export function validateStateLimits(state) {
  if (state.collection.length > MAX_ARMIES) {
    return `Too many armies (max ${MAX_ARMIES})`;
  }
  if (state.paints.length > MAX_PAINTS) {
    return `Too many paints (max ${MAX_PAINTS})`;
  }
  let units = 0;
  for (const army of state.collection) {
    const count = Array.isArray(army.units) ? army.units.length : 0;
    if (count > MAX_UNITS_PER_ARMY) {
      return `Army "${army.army}" exceeds ${MAX_UNITS_PER_ARMY} unit entries`;
    }
    units += count;
    if (units > MAX_UNITS_TOTAL) {
      return `Too many unit entries (max ${MAX_UNITS_TOTAL})`;
    }
  }
  return null;
}

/** @param {unknown} raw @param {{ enforceLimits?: boolean }} [opts] */
export function sanitizeAppState(raw, opts = {}) {
  const d = /** @type {Record<string, unknown>} */ (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {});

  if (opts.enforceLimits) {
    if (Array.isArray(d.collection)) {
      if (d.collection.length > MAX_ARMIES) {
        return { ok: false, error: `Too many armies (max ${MAX_ARMIES})` };
      }
      let units = 0;
      for (const a of d.collection) {
        const army = a && typeof a === 'object' ? /** @type {{ army?: string, units?: unknown[] }} */ (a) : {};
        const count = Array.isArray(army.units) ? army.units.length : 0;
        if (count > MAX_UNITS_PER_ARMY) {
          return { ok: false, error: `Army "${army.army || 'unknown'}" exceeds ${MAX_UNITS_PER_ARMY} unit entries` };
        }
        units += count;
        if (units > MAX_UNITS_TOTAL) {
          return { ok: false, error: `Too many unit entries (max ${MAX_UNITS_TOTAL})` };
        }
      }
    }
    if (Array.isArray(d.paints) && d.paints.length > MAX_PAINTS) {
      return { ok: false, error: `Too many paints (max ${MAX_PAINTS})` };
    }
  }

  /** @type {import('../core/constants.js').AppState} */
  const state = {
    version: typeof d.version === 'number' ? d.version : APP_VERSION,
    collection: [],
    paints: [],
    settings: structuredClone(DEFAULT_SETTINGS),
  };

  if (Array.isArray(d.collection)) {
    state.collection = d.collection.slice(0, MAX_ARMIES).map(a => {
      const army = /** @type {Record<string, unknown>} */ (a && typeof a === 'object' ? a : {});
      const units = Array.isArray(army.units) ? army.units.slice(0, MAX_UNITS_PER_ARMY) : [];
      let armyPipeline = null;
      if (Array.isArray(army.pipeline)) {
        armyPipeline = army.pipeline.slice(0, 30).map(s => {
          const stage = /** @type {Record<string, unknown>} */ (s && typeof s === 'object' ? s : {});
          const key = capStr(stage.key, MAX_STRING_LEN);
          return key ? { key, hex: safeColor(stage.hex) } : null;
        }).filter(/** @type {(x: {key: string, hex: string}|null) => x is {key: string, hex: string}} */ (x) => x !== null);
        if (!armyPipeline.length) armyPipeline = null;
      }
      return {
        army: capStr(army.army, MAX_STRING_LEN),
        game: capStr(army.game, MAX_STRING_LEN),
        faction: capStr(army.faction, MAX_STRING_LEN),
        crest: capStr(army.crest, 8),
        color: safeColor(army.color),
        crestOverride: capStr(army.crestOverride, 8) || undefined,
        colorOverride: army.colorOverride ? safeColor(army.colorOverride) : undefined,
        pipeline: armyPipeline,
        units: units.map(u => {
          const unit = /** @type {Record<string, unknown>} */ (u && typeof u === 'object' ? u : {});
          const row = {
            unit: capStr(unit.unit, MAX_STRING_LEN),
            qty: Math.max(1, Math.min(9999, Number(unit.qty) || 1)),
            source: capStr(unit.source, MAX_STRING_LEN),
            state: capStr(unit.state, MAX_STRING_LEN),
            notes: capStr(unit.notes, MAX_NOTES_LEN),
          };
          if (unit.spearhead === true) row.spearhead = true;
          else if (unit.spearhead === false) row.spearhead = false;
          return row;
        }),
      };
    }).filter(a => a.army);
  }

  if (Array.isArray(d.paints)) {
    state.paints = d.paints.slice(0, MAX_PAINTS).map(p => {
      const paint = /** @type {Record<string, unknown>} */ (p && typeof p === 'object' ? p : {});
      return {
        name: capStr(paint.name, MAX_STRING_LEN),
        type: capStr(paint.type, MAX_STRING_LEN),
        swatch: safeColor(paint.swatch),
        qty: Math.max(1, Math.min(9999, Number(paint.qty) || 1)),
        brand: capStr(paint.brand, MAX_STRING_LEN),
        source: capStr(paint.source, MAX_STRING_LEN),
        notes: capStr(paint.notes, MAX_NOTES_LEN),
        ...(paint.low === true ? { low: true } : {}),
      };
    }).filter(p => p.name);
  }

  const settings = /** @type {Record<string, unknown>} */ (
    d.settings && typeof d.settings === 'object' && !Array.isArray(d.settings) ? d.settings : {}
  );
  const theme = settings.theme;
  if (typeof theme === 'string' && THEMES.has(theme)) {
    state.settings.theme = /** @type {'dark'|'light'|'system'} */ (theme);
  }
  if (Array.isArray(settings.pipeline)) {
    state.settings.pipeline = settings.pipeline.slice(0, 30).map(s => {
      const stage = /** @type {Record<string, unknown>} */ (s && typeof s === 'object' ? s : {});
      const key = capStr(stage.key, MAX_STRING_LEN);
      return key ? { key, hex: safeColor(stage.hex) } : null;
    }).filter(/** @type {(x: {key: string, hex: string}|null) => x is {key: string, hex: string}} */ (x) => x !== null);
    if (!state.settings.pipeline.length) state.settings.pipeline = null;
  }
  if (Array.isArray(settings.collapsedArmies)) {
    state.settings.collapsedArmies = settings.collapsedArmies
      .slice(0, MAX_ARMIES)
      .map(a => capStr(a, MAX_STRING_LEN))
      .filter(Boolean);
  }
  const filterStr = (v) => (typeof v === 'string' ? capStr(v, MAX_STRING_LEN) : undefined);
  const gf = filterStr(settings.gameFilter);
  if (gf) state.settings.gameFilter = gf;
  const ff = filterStr(settings.factionFilter);
  if (ff) state.settings.factionFilter = ff;
  const sf = filterStr(settings.stateFilter);
  if (sf) state.settings.stateFilter = sf;
  const srcf = filterStr(settings.sourceFilter);
  if (srcf) state.settings.sourceFilter = srcf;
  if (settings.spearheadOnly === true) state.settings.spearheadOnly = true;
  const as = filterStr(settings.armySort);
  if (as && ['csv', 'name', 'progress'].includes(as)) state.settings.armySort = as;
  const us = filterStr(settings.unitSort);
  if (us && ['name', 'state'].includes(us)) state.settings.unitSort = us;
  const qv = filterStr(settings.quickView);
  if (qv && ['all', 'backlog', 'wip', 'ready'].includes(qv)) state.settings.quickView = qv;
  const tf = filterStr(settings.tagFilter);
  if (tf) state.settings.tagFilter = tf;
  if (typeof settings.lastBackupAt === 'string') {
    state.settings.lastBackupAt = capStr(settings.lastBackupAt, 40);
  }
  if (settings.factionPresets && typeof settings.factionPresets === 'object' && !Array.isArray(settings.factionPresets)) {
    /** @type {Record<string, [string, string]>} */
    const fp = {};
    for (const [k, v] of Object.entries(/** @type {Record<string, unknown>} */ (settings.factionPresets))) {
      if (!Array.isArray(v) || v.length < 2) continue;
      fp[capStr(k, MAX_STRING_LEN)] = [capStr(v[0], 8), safeColor(v[1])];
    }
    if (Object.keys(fp).length) state.settings.factionPresets = fp;
  }

  state.version = APP_VERSION;

  if (opts.enforceLimits) {
    const limitErr = validateStateLimits(state);
    if (limitErr) return { ok: false, error: limitErr };
  }

  return { ok: true, state };
}

/**
 * @param {string} json
 * @param {{ byteLength?: number, strictKeys?: boolean, enforceLimits?: boolean }} [opts]
 */
export function parseBackup(json, opts = {}) {
  const { byteLength, strictKeys = true, enforceLimits = true } = opts;
  const size = byteLength ?? json.length;
  if (size > MAX_IMPORT_BYTES) {
    const mb = Math.round(MAX_IMPORT_BYTES / (1024 * 1024));
    return { ok: false, error: `File exceeds ${mb} MB limit` };
  }
  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Backup must be a JSON object' };
  }
  if (strictKeys) {
    const extra = Object.keys(raw).filter(k => !BACKUP_KEYS.has(k));
    if (extra.length) {
      return { ok: false, error: `Unknown backup fields: ${extra.join(', ')}` };
    }
  }
  const sanitized = sanitizeAppState(raw, { enforceLimits });
  if (!sanitized.ok) return sanitized;
  return {
    ok: true,
    state: sanitized.state,
    preview: backupPreview(sanitized.state),
  };
}
