import {
  APP_VERSION,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  LEGACY_THEME_KEY,
  DEFAULT_SETTINGS,
} from './constants.js';
import { resolvePipeline } from './pipeline.js';

/** @type {import('./constants.js').AppState} */
const state = {
  version: APP_VERSION,
  collection: [],
  paints: [],
  settings: structuredClone(DEFAULT_SETTINGS),
};

/** @type {Set<(reason: string, detail?: unknown) => void>} */
const listeners = new Set();

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

export function getFactionPresets() {
  return state.settings.factionPresets || null;
}

/** @param {string} domain */
function persist(domain) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: APP_VERSION,
      collection: state.collection,
      paints: state.paints,
      settings: state.settings,
    }));
    notify(domain);
    return true;
  } catch (err) {
    const message = err instanceof DOMException && err.name === 'QuotaExceededError'
      ? 'Storage full — export a backup and free space'
      : 'Could not save — your changes may be lost';
    notify('save-error', { message, domain });
    return false;
  }
}

/** @param {Partial<import('./constants.js').Settings>} patch */
export function patchSettings(patch) {
  Object.assign(state.settings, patch);
  persist('settings');
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

/** @param {string} armyName @param {number} index @param {Partial<{ unit: string, qty: number, source: string, state: string, notes: string, spearhead: boolean }>} patch */
export function updateUnit(armyName, index, patch) {
  const army = state.collection.find(a => a.army === armyName);
  const unit = army?.units[index];
  if (!unit) return false;
  Object.assign(unit, patch);
  persist('collection');
  return true;
}

/** @param {string} armyName @param {number} index */
export function removeUnit(armyName, index) {
  const army = state.collection.find(a => a.army === armyName);
  if (!army || index < 0 || index >= army.units.length) return false;
  army.units.splice(index, 1);
  persist('collection');
  return true;
}

/** @param {string} armyName @param {object} unit */
export function addUnit(armyName, unit) {
  const army = state.collection.find(a => a.army === armyName);
  if (!army) return false;
  army.units.push(unit);
  persist('collection');
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

/** @param {unknown} raw */
function normalizeLoaded(raw) {
  const d = /** @type {Partial<import('./constants.js').AppState>} */ (raw);
  return {
    version: d.version ?? APP_VERSION,
    collection: Array.isArray(d.collection) ? d.collection : [],
    paints: Array.isArray(d.paints) ? d.paints : [],
    settings: { ...structuredClone(DEFAULT_SETTINGS), ...(d.settings || {}) },
  };
}

function migrateLegacyTheme() {
  const legacy = localStorage.getItem(LEGACY_THEME_KEY);
  if (legacy && !state.settings.theme) {
    state.settings.theme = /** @type {'dark'|'light'|'system'} */ (legacy);
  }
  if (legacy) localStorage.removeItem(LEGACY_THEME_KEY);
}

export function load() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const migrated = migrateLegacyV2(JSON.parse(legacy));
        Object.assign(state, migrated);
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

/** @param {string} json */
export function importSnapshot(json) {
  try {
    const data = normalizeLoaded(JSON.parse(json));
    Object.assign(state, data);
    persist('all');
    return true;
  } catch {
    notify('load-error', { message: 'Invalid backup file' });
    return false;
  }
}
