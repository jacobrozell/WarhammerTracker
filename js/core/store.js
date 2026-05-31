import {
  APP_VERSION,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  LEGACY_THEME_KEY,
  DEFAULT_SETTINGS,
} from './constants.js';
import { STORAGE_BUDGET_BYTES, STORAGE_WARN_RATIO } from './limits.js';
import { resolvePipeline, getPipelineForArmy } from './pipeline.js';
import {
  ensureSquadMembers,
  clearSquadMembers,
  setMember,
  resizeSquadMembers,
  squadSize,
  hasSquadMembers,
} from './members.js';
import { sanitizeAppState, parseBackup } from '../data/sanitize.js';
import { resolveFactionPreset, syncArmyThemeFromPresets } from '../data/faction-presets.js';

/** @type {import('./constants.js').AppState} */
const state = {
  version: APP_VERSION,
  collection: [],
  paints: [],
  settings: structuredClone(DEFAULT_SETTINGS),
};

/** @type {Set<(reason: string, detail?: unknown) => void>} */
const listeners = new Set();

/** @type {{ type: string, payload: unknown }[]} */
const undoStack = [];
const UNDO_MAX = 30;

/** @param {{ type: string, payload: unknown }} entry */
function pushUndo(entry) {
  undoStack.push(entry);
  if (undoStack.length > UNDO_MAX) undoStack.shift();
}

export function canUndo() {
  return undoStack.length > 0;
}

/** @param {{ armyName: string, index: number, state: string }[]} changes */
export function pushUndoBatchStates(changes) {
  if (changes.length) pushUndo({ type: 'batch-states', payload: structuredClone(changes) });
}

let batchDepth = 0;
let batchSilent = false;
let storageWarned = false;

/** @param {string} [reason] @param {unknown} [detail] */
export function notify(reason = 'change', detail) {
  listeners.forEach(fn => fn(reason, detail));
}

/** @param {(reason: string, detail?: unknown) => void} fn */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  return state;
}

export function getPipeline() {
  return resolvePipeline(state.settings.pipeline);
}

/** @param {import('./constants.js').Army|null|undefined} army */
export function getArmyPipeline(army) {
  return getPipelineForArmy(army, state.settings.pipeline);
}

export function recordBackup() {
  patchSettings({ lastBackupAt: new Date().toISOString() }, { silent: true });
}

export function getFactionPresets() {
  return state.settings.factionPresets || null;
}

export function getCollapsedArmies() {
  return new Set(state.settings.collapsedArmies || []);
}

/** @param {Set<string>} collapsed */
export function setCollapsedArmies(collapsed) {
  state.settings.collapsedArmies = [...collapsed];
  persist('settings', { silent: true });
}

function checkStorageQuota(payload) {
  if (storageWarned) return;
  const bytes = new Blob([payload]).size;
  if (bytes >= STORAGE_BUDGET_BYTES * STORAGE_WARN_RATIO) {
    storageWarned = true;
    notify('storage-warn', {
      message: 'Storage nearly full — export a Full backup soon',
      bytes,
    });
  }
}

/** @param {{ silent?: boolean }} [opts] */
function persist(domain, opts = {}) {
  if (batchDepth > 0) return true;
  try {
    const payload = JSON.stringify({
      version: APP_VERSION,
      collection: state.collection,
      paints: state.paints,
      settings: state.settings,
    });
    localStorage.setItem(STORAGE_KEY, payload);
    checkStorageQuota(payload);
    const silent = opts.silent || batchSilent;
    notify(domain, silent ? { silent: true } : undefined);
    return true;
  } catch (err) {
    const message = err instanceof DOMException && err.name === 'QuotaExceededError'
      ? 'Storage full — export a backup and free space'
      : 'Could not save — your changes may be lost';
    notify('save-error', { message, domain });
    return false;
  }
}

/** @param {{ silent?: boolean }} [opts] */
export function beginBatch(opts = {}) {
  batchDepth++;
  if (opts.silent) batchSilent = true;
}

/** @param {string} domain */
export function endBatch(domain = 'collection') {
  if (batchDepth > 0) batchDepth--;
  if (batchDepth === 0) {
    batchSilent = false;
    persist(domain);
  }
}

/** @param {Partial<import('./constants.js').Settings>} patch @param {{ silent?: boolean }} [opts] */
export function patchSettings(patch, opts = {}) {
  Object.assign(state.settings, patch);
  persist('settings', opts);
}

/** @param {import('./constants.js').Army[]} armies */
export function setCollection(armies) {
  state.collection = armies;
  persist('collection');
}

/** @param {import('./constants.js').Paint[]} paints */
export function setPaints(paints) {
  state.paints = paints;
  persist('paints');
}

/** @param {import('./constants.js').Paint[]} paints */
export function appendPaints(paints) {
  const seen = new Map(state.paints.map(p => [p.name.toLowerCase(), p]));
  paints.forEach(p => {
    const k = p.name.toLowerCase();
    const existing = seen.get(k);
    if (existing) {
      existing.qty = (existing.qty || 1) + (p.qty || 1);
      if (p.notes && !existing.notes) existing.notes = p.notes;
    } else {
      state.paints.push(p);
      seen.set(k, p);
    }
  });
  persist('paints');
}

/** @param {import('./constants.js').Army[]} armies */
export function appendCollection(armies) {
  armies.forEach(incoming => {
    const existing = state.collection.find(a => a.army === incoming.army);
    if (existing) existing.units.push(...incoming.units);
    else state.collection.push(incoming);
  });
  persist('collection');
}

export function clearAllData() {
  state.collection = [];
  state.paints = [];
  state.settings = structuredClone(DEFAULT_SETTINGS);
  persist('all');
}

/** @param {string} armyName @param {Partial<{ unit: string, qty: number, source: string, state: string, notes: string, spearhead: boolean }>} patch @param {{ silent?: boolean, skipUndo?: boolean }} [opts] */
export function updateUnit(armyName, index, patch, opts = {}) {
  const army = state.collection.find(a => a.army === armyName);
  const unit = army?.units[index];
  if (!unit) return false;
  if (!opts.silent && !opts.skipUndo && 'state' in patch && patch.state !== unit.state) {
    pushUndo({ type: 'unit-state', payload: { armyName, index, state: unit.state } });
  }
  Object.assign(unit, patch);
  if (hasSquadMembers(unit)) resizeSquadMembers(unit);
  persist('collection', opts);
  return true;
}

/** @param {string} armyName @param {number} index */
export function enableSquadMembers(armyName, index) {
  const army = state.collection.find(a => a.army === armyName);
  const unit = army?.units[index];
  if (!unit || squadSize(unit) < 2) return false;
  ensureSquadMembers(unit);
  persist('collection');
  return true;
}

/** @param {string} armyName @param {number} index */
export function disableSquadMembers(armyName, index) {
  const army = state.collection.find(a => a.army === armyName);
  const unit = army?.units[index];
  if (!unit || !hasSquadMembers(unit)) return false;
  clearSquadMembers(unit);
  persist('collection');
  return true;
}

/**
 * @param {string} armyName
 * @param {number} unitIndex
 * @param {number} memberIndex
 * @param {Partial<{ state: string, notes: string }>} patch
 * @param {{ silent?: boolean }} [opts]
 */
export function updateMember(armyName, unitIndex, memberIndex, patch, opts = {}) {
  const army = state.collection.find(a => a.army === armyName);
  const unit = army?.units[unitIndex];
  if (!unit || !hasSquadMembers(unit)) return false;
  if (memberIndex < 0 || memberIndex >= unit.members.length) return false;
  setMember(unit, memberIndex, patch);
  persist('collection', opts);
  return true;
}

/** @param {string} armyName @param {number} index */
export function removeUnit(armyName, index) {
  const army = state.collection.find(a => a.army === armyName);
  if (!army || index < 0 || index >= army.units.length) return false;
  const removed = army.units.splice(index, 1)[0];
  pushUndo({ type: 'unit', payload: { armyName, index, unit: structuredClone(removed) } });
  persist('collection');
  return true;
}

export function undoLast() {
  const entry = undoStack.pop();
  if (!entry) return false;
  if (entry.type === 'unit') {
    const { armyName, index, unit } = /** @type {{ armyName: string, index: number, unit: object }} */ (entry.payload);
    const army = state.collection.find(a => a.army === armyName);
    if (!army) return false;
    army.units.splice(index, 0, unit);
    persist('collection');
    return true;
  }
  if (entry.type === 'army') {
    const army = /** @type {import('./constants.js').Army} */ (entry.payload);
    if (state.collection.some(a => a.army === army.army)) return false;
    state.collection.push(army);
    persist('collection');
    return true;
  }
  if (entry.type === 'unit-state') {
    const { armyName, index, state: prev } = /** @type {{ armyName: string, index: number, state: string }} */ (entry.payload);
    updateUnit(armyName, index, { state: prev }, { silent: true, skipUndo: true });
    return true;
  }
  if (entry.type === 'batch-states') {
    const changes = /** @type {{ armyName: string, index: number, state: string }[]} */ (entry.payload);
    beginBatch({ silent: true });
    changes.forEach(({ armyName, index, state: prev }) => {
      updateUnit(armyName, index, { state: prev }, { silent: true, skipUndo: true });
    });
    endBatch('collection');
    return true;
  }
  return false;
}

/** @param {string} armyName @param {object} unit */
export function addUnit(armyName, unit) {
  const army = state.collection.find(a => a.army === armyName);
  if (!army) return false;
  army.units.push(unit);
  persist('collection');
  return true;
}

/** @param {import('./constants.js').Army} army */
export function addArmy(army) {
  if (state.collection.some(a => a.army === army.army)) return false;
  state.collection.push(army);
  persist('collection');
  return true;
}

/** @param {string} armyName */
export function removeArmy(armyName) {
  const i = state.collection.findIndex(a => a.army === armyName);
  if (i < 0) return false;
  const [removed] = state.collection.splice(i, 1);
  pushUndo({ type: 'army', payload: structuredClone(removed) });
  persist('collection');
  return true;
}

/** @param {string} fromName @param {string} toName */
export function renameArmy(fromName, toName) {
  const army = state.collection.find(a => a.army === fromName);
  if (!army || state.collection.some(a => a.army === toName && a !== army)) return false;
  army.army = toName;
  persist('collection');
  return true;
}

/** @param {string} armyName @param {import('./constants.js').PipelineStage[]|null} pipeline */
export function setArmyPipeline(armyName, pipeline) {
  const army = state.collection.find(a => a.army === armyName);
  if (!army) return false;
  army.pipeline = pipeline?.length ? pipeline.map(s => ({ key: s.key, hex: s.hex })) : null;
  persist('collection');
  return true;
}

/** @param {Record<string, [string, string]>|null} presets */
export function applyFactionPresets(presets) {
  patchSettings({ factionPresets: presets }, { silent: true });
  state.collection.forEach(a => {
    syncArmyThemeFromPresets(a, presets);
  });
  persist('collection');
}

/** @param {string} armyName */
export function reapplyArmyFactionDefaults(armyName) {
  const army = state.collection.find(a => a.army === armyName);
  if (!army) return false;
  syncArmyThemeFromPresets(army, state.settings.factionPresets);
  persist('collection');
  return true;
}

/** @param {string} fromArmy @param {number} index @param {string} toArmy */
export function moveUnit(fromArmy, index, toArmy) {
  const src = state.collection.find(a => a.army === fromArmy);
  const dst = state.collection.find(a => a.army === toArmy);
  if (!src || !dst || fromArmy === toArmy || index < 0 || index >= src.units.length) return false;
  const [unit] = src.units.splice(index, 1);
  dst.units.push(unit);
  persist('collection');
  return true;
}

/** @param {string} armyName */
export function mergeArmyDuplicates(armyName) {
  const army = state.collection.find(a => a.army === armyName);
  if (!army) return 0;
  /** @type {Map<string, object>} */
  const merged = new Map();
  army.units.forEach(u => {
    const mem = u.members?.length ? JSON.stringify(u.members) : '';
    const key = `${u.unit}\0${u.source || ''}\0${u.state}\0${u.spearhead ?? ''}\0${mem}`;
    const existing = merged.get(key);
    if (existing) {
      existing.qty = (existing.qty || 1) + (u.qty || 1);
      if (u.notes && !existing.notes) existing.notes = u.notes;
    } else {
      merged.set(key, structuredClone(u));
    }
  });
  const before = army.units.length;
  army.units = [...merged.values()];
  if (army.units.length === before) return 0;
  persist('collection');
  return before - army.units.length;
}

/** @param {import('./constants.js').Paint} paint */
export function addPaint(paint) {
  if (state.paints.some(p => p.name.toLowerCase() === paint.name.toLowerCase())) return false;
  state.paints.push(paint);
  persist('paints');
  return true;
}

/** @param {string} name @param {Partial<import('./constants.js').Paint>} patch */
export function updatePaint(name, patch) {
  const p = state.paints.find(x => x.name === name);
  if (!p) return false;
  if (patch.name && patch.name !== name
    && state.paints.some(x => x !== p && x.name.toLowerCase() === patch.name.toLowerCase())) {
    return false;
  }
  Object.assign(p, patch);
  persist('paints');
  return true;
}

/** @param {string} name */
export function removePaint(name) {
  const i = state.paints.findIndex(p => p.name === name);
  if (i < 0) return false;
  state.paints.splice(i, 1);
  persist('paints');
  return true;
}

/** @param {string} armyName @param {number} index */
export function duplicateUnit(armyName, index) {
  const army = state.collection.find(a => a.army === armyName);
  const unit = army?.units[index];
  if (!unit) return false;
  army.units.splice(index + 1, 0, structuredClone(unit));
  persist('collection');
  return true;
}

/** @param {string} armyName @param {string} stateKey */
export function setAllUnitsState(armyName, stateKey) {
  const army = state.collection.find(a => a.army === armyName);
  if (!army) return false;
  beginBatch({ silent: true });
  army.units.forEach((_, i) => updateUnit(armyName, i, { state: stateKey }, { silent: true }));
  endBatch('collection');
  return true;
}

/** @param {unknown} raw */
function migrateLegacyV2(raw) {
  const d = /** @type {{ c?: import('./constants.js').Army[], p?: import('./constants.js').Paint[] }} */ (raw);
  return {
    version: APP_VERSION,
    collection: d.c || [],
    paints: d.p || [],
    settings: structuredClone(DEFAULT_SETTINGS),
  };
}

/** @param {{ version: number, collection: import('./constants.js').Army[], paints: import('./constants.js').Paint[], settings: import('./constants.js').Settings }} data */
function runMigrations(data) {
  // Bump APP_VERSION and add migrateV3toV4() here when schema changes.
  return { ...data, version: APP_VERSION };
}

/** @param {unknown} raw */
function normalizeLoaded(raw) {
  const sanitized = sanitizeAppState(raw, { enforceLimits: false });
  if (!sanitized.ok) {
    return {
      version: APP_VERSION,
      collection: [],
      paints: [],
      settings: structuredClone(DEFAULT_SETTINGS),
    };
  }
  return runMigrations(sanitized.state);
}

function migrateLegacyTheme() {
  const legacy = localStorage.getItem(LEGACY_THEME_KEY);
  if (!legacy) return;
  if (['dark', 'light', 'system'].includes(legacy)) {
    let savedTheme;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) savedTheme = JSON.parse(raw)?.settings?.theme;
    } catch { /* ignore */ }
    if (!savedTheme || savedTheme === '' || !['dark', 'light', 'system'].includes(savedTheme)) {
      state.settings.theme = /** @type {'dark'|'light'|'system'} */ (legacy);
    }
  }
  localStorage.removeItem(LEGACY_THEME_KEY);
}

export function load() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const migrated = migrateLegacyV2(JSON.parse(legacy));
        Object.assign(state, normalizeLoaded(migrated));
        migrateLegacyTheme();
        persist('collection');
        return true;
      }
      migrateLegacyTheme();
      return false;
    }
    Object.assign(state, normalizeLoaded(JSON.parse(raw)));
    migrateLegacyTheme();
    if (localStorage.getItem(LEGACY_THEME_KEY)) {
      persist('settings');
    }
    return true;
  } catch {
    notify('load-error', { message: 'Could not load saved data — starting fresh' });
    return false;
  }
}

/** Full JSON export for backup / future cloud sync */
export function exportSnapshot() {
  return JSON.stringify({
    version: APP_VERSION,
    collection: state.collection,
    paints: state.paints,
    settings: state.settings,
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

/** @param {string} json @param {{ byteLength?: number }} [opts] */
export function importSnapshot(json, opts = {}) {
  const result = parseBackup(json, {
    byteLength: opts.byteLength,
    strictKeys: true,
    enforceLimits: true,
  });
  if (!result.ok) {
    notify('load-error', { message: result.error });
    return false;
  }
  Object.assign(state, result.state);
  persist('all');
  return true;
}

/** @param {string} json @param {{ byteLength?: number }} [opts] */
export function previewBackup(json, opts = {}) {
  return parseBackup(json, {
    byteLength: opts.byteLength,
    strictKeys: true,
    enforceLimits: true,
  });
}
