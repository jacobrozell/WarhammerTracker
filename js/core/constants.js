/** @typedef {{ key: string, hex: string }} PipelineStage */
/** @typedef {{ army: string, game: string, faction: string, crest: string, color: string, crestOverride?: string, colorOverride?: string, pipeline?: PipelineStage[]|null, units: object[] }} Army */
/** @typedef {{ name: string, type: string, swatch: string, qty: number, brand: string, source: string, notes: string, low?: boolean }} Paint */
/** @typedef {{ theme: 'dark'|'light'|'system', pipeline: PipelineStage[]|null, factionPresets: Record<string,[string,string]>|null, collapsedArmies?: string[], armySort?: string, unitSort?: string, gameFilter?: string, factionFilter?: string, stateFilter?: string, sourceFilter?: string, tagFilter?: string, spearheadOnly?: boolean, quickView?: string, lastBackupAt?: string, seenStorageBanner?: boolean }} Settings */
/** @typedef {{ version: number, collection: Army[], paints: Paint[], settings: Settings }} AppState */

export const APP_VERSION = 3;
export const STORAGE_KEY = 'musterRoll.v3';
export const LEGACY_STORAGE_KEY = 'musterRoll.v2';
export const LEGACY_THEME_KEY = 'musterRoll.theme';

/** @type {PipelineStage[]} */
export const DEFAULT_PIPELINE = [
  { key: 'Unassembled', hex: '#4a4d57' },
  { key: 'Assembled', hex: '#6366f1' },
  { key: 'Magnetising', hex: '#0ea5e9' },
  { key: 'Magnetised', hex: '#06b6d4' },
  { key: 'Primed', hex: '#f97316' },
  { key: 'Base Coated', hex: '#eab308' },
  { key: 'Detailed', hex: '#84cc16' },
  { key: 'Based', hex: '#16a34a' },
  { key: 'Done', hex: '#22c55e' },
];

export {
  DEFAULT_FACTION_PRESETS,
  CANONICAL_FACTIONS,
  SUPPORTED_GAMES,
  mergeFactionPresets,
  resolveFactionPreset,
  getArmyPresentation,
  isFallbackPreset,
} from '../data/faction-presets.js';

/** Paint type → default swatch colour */
export const DEFAULT_PAINT_TYPES = {
  Base: '#7a7a7a',
  Shade: '#3a2c1c',
  Technical: '#5a5550',
  Speedpaint: '#888',
  'Speedpaint Metallic': '#9a9da1',
  Medium: '#d9d4c8',
  Primer: '#6b6b6b',
  Basing: '#6b7a3a',
};

/** @type {Settings} */
export const DEFAULT_SETTINGS = {
  theme: 'dark',
  pipeline: null,
  factionPresets: null,
};

export const DONE_STATES = ['Based', 'Done'];
