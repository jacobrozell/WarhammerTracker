import { FACTION_DEFS } from './defs.js';
import { FACTION_ALIASES } from './aliases.js';

export const FACTION_PRESET_FALLBACK_COLOR = '#888';

/** @param {string} game @param {string} faction */
export function compositePresetKey(game, faction) {
  const g = (game || '').trim();
  const f = (faction || '').trim();
  return g && f ? `${g}:${f}` : f;
}

/** @param {import('./defs.js').FactionDef[]} defs */
export function buildPresetMaps(defs) {
  /** @type {Record<string, [string, string]>} */
  const flat = {};
  /** @type {Record<string, [string, string]>} */
  const composite = {};
  /** @type {Record<string, string[]>} */
  const canonical = {};

  for (const d of defs) {
    const tuple = /** @type {[string, string]} */ ([d.crest, d.color]);
    for (const game of d.games) {
      composite[compositePresetKey(game, d.label)] = tuple;
      if (!canonical[game]) canonical[game] = [];
      canonical[game].push(d.label);
    }
    flat[d.label] = tuple;
    for (const alias of d.aliases || []) {
      flat[alias] = tuple;
    }
  }

  return { flat, composite, canonical };
}

const built = buildPresetMaps(FACTION_DEFS);

export const DEFAULT_FACTION_PRESETS = built.flat;
export const COMPOSITE_FACTION_PRESETS = built.composite;
export const CANONICAL_FACTIONS = built.canonical;

/** @type {Record<string, string>} lowercase → canonical label */
const LABEL_LC = (() => {
  /** @type {Record<string, string>} */
  const map = {};
  for (const d of FACTION_DEFS) {
    map[d.label.toLowerCase()] = d.label;
    for (const alias of d.aliases || []) map[alias.toLowerCase()] = d.label;
  }
  for (const [alias, label] of Object.entries(FACTION_ALIASES)) {
    map[alias.toLowerCase()] = label;
  }
  return map;
})();

/** @param {string} faction */
export function normalizeFactionLabel(faction) {
  const raw = (faction || '').trim();
  if (!raw) return '';
  return FACTION_ALIASES[raw] || LABEL_LC[raw.toLowerCase()] || raw;
}

/**
 * @param {Record<string, [string, string]>|null|undefined} overrides
 * @returns {Record<string, [string, string]>}
 */
export function mergeFactionPresets(overrides) {
  if (!overrides || typeof overrides !== 'object') {
    return { ...DEFAULT_FACTION_PRESETS, ...COMPOSITE_FACTION_PRESETS };
  }
  return { ...DEFAULT_FACTION_PRESETS, ...COMPOSITE_FACTION_PRESETS, ...overrides };
}

/**
 * @param {string} faction
 * @param {{ game?: string, presets?: Record<string, [string, string]>|null }} [options]
 * @returns {[string, string]}
 */
export function resolveFactionPreset(faction, options) {
  const map = mergeFactionPresets(options?.presets);
  const label = normalizeFactionLabel(faction);
  const game = (options?.game || '').trim();

  if (game) {
    const scoped = map[compositePresetKey(game, label)];
    if (scoped) return scoped;
  } else {
    const flat = map[label];
    if (flat) return flat;
  }

  const abbr = (label.slice(0, 2) || '??').toUpperCase();
  return [abbr, FACTION_PRESET_FALLBACK_COLOR];
}

/** @param {[string, string]} tuple */
export function isFallbackPreset(tuple) {
  return tuple[1] === FACTION_PRESET_FALLBACK_COLOR;
}

/**
 * @param {Pick<import('../../core/constants.js').Army, 'game'|'faction'> & Partial<import('../../core/constants.js').Army>} army
 * @param {Record<string, [string, string]>|null|undefined} userPresets
 * @returns {{ crest: string, color: string }}
 */
export function getArmyPresentation(army, userPresets) {
  const resolved = resolveFactionPreset(army.faction, { game: army.game, presets: userPresets });
  return {
    crest: army.crestOverride || resolved[0] || army.crest || '??',
    color: army.colorOverride || resolved[1] || army.color || FACTION_PRESET_FALLBACK_COLOR,
  };
}

/** @param {import('../../core/constants.js').Army} army */
export function clearArmyThemeOverrides(army) {
  delete army.crestOverride;
  delete army.colorOverride;
}

/**
 * @param {import('../../core/constants.js').Army} army
 * @param {Record<string, [string, string]>|null|undefined} userPresets
 */
export function syncArmyThemeFromPresets(army, userPresets) {
  clearArmyThemeOverrides(army);
  const [crest, color] = resolveFactionPreset(army.faction, { game: army.game, presets: userPresets });
  army.crest = crest;
  army.color = color;
}
