export { FACTION_DEFS, SUPPORTED_GAMES, G } from './defs.js';
export { auditFactionContrasts, contrastRatio, THEME_SURFACES } from './contrast.js';
export { FACTION_ALIASES } from './aliases.js';
export {
  DEFAULT_FACTION_PRESETS,
  COMPOSITE_FACTION_PRESETS,
  CANONICAL_FACTIONS,
  FACTION_PRESET_FALLBACK_COLOR,
  compositePresetKey,
  buildPresetMaps,
  normalizeFactionLabel,
  mergeFactionPresets,
  resolveFactionPreset,
  isFallbackPreset,
  getArmyPresentation,
  clearArmyThemeOverrides,
  syncArmyThemeFromPresets,
} from './build.js';
