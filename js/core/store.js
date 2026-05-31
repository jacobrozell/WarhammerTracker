import {
  APP_VERSION,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
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

/** @type {Set<(reason: string) => void>} */
const listeners = new Set();

/** @param {string} [reason] */
export function notify(reason = 'change') {
  listeners.forEach(fn => fn(reason));
}

/** @param {(reason: string) => void} fn */
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

/** @param {Partial<import('./constants.js').Settings>} patch */
export function patchSettings(patch) {
  Object.assign(state.settings, patch);
  save();
}

/** @param {import('./constants.js').Army[]} armies */
export function setCollection(armies) {
  state.collection = armies;
  save();
}

/** @param {import('./constants.js').Paint[]} paints */
export function setPaints(paints) {
  state.paints = paints;
  save();
}

export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: APP_VERSION,
      collection: state.collection,
      paints: state.paints,
      settings: state.settings,
    }));
    notify('save');
    return true;
  } catch {
    return false;
  }
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

export function load() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const migrated = migrateLegacyV2(JSON.parse(legacy));
        Object.assign(state, migrated);
        save();
        return true;
      }
      return false;
    }
    Object.assign(state, normalizeLoaded(JSON.parse(raw)));
    return true;
  } catch {
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
  const data = normalizeLoaded(JSON.parse(json));
  Object.assign(state, data);
  save();
}

export const store = state;
