import { describe, it, expect } from 'vitest';
import {
  compositePresetKey,
  normalizeFactionLabel,
  clearArmyThemeOverrides,
} from '../js/data/factions/build.js';
import { FACTION_ALIASES } from '../js/data/factions/aliases.js';

describe('compositePresetKey', () => {
  it('joins game and faction with colon', () => {
    expect(compositePresetKey('40k', 'Ultramarines')).toBe('40k:Ultramarines');
  });

  it('returns faction only when game is blank', () => {
    expect(compositePresetKey('', 'Skaven')).toBe('Skaven');
  });

  it('trims whitespace', () => {
    expect(compositePresetKey('  AoS ', ' Skaven ')).toBe('AoS:Skaven');
  });
});

describe('normalizeFactionLabel', () => {
  it('maps legacy Heretic Astartes aliases', () => {
    const alias = 'Heretic Astartes: Death Guard';
    expect(FACTION_ALIASES[alias]).toBe('Death Guard');
    expect(normalizeFactionLabel(alias)).toBe('Death Guard');
  });

  it('normalizes case via catalogue', () => {
    expect(normalizeFactionLabel('ultramarines')).toBe('Ultramarines');
  });

  it('returns trimmed raw label when unknown', () => {
    expect(normalizeFactionLabel('  Custom Chapter  ')).toBe('Custom Chapter');
  });
});

describe('clearArmyThemeOverrides', () => {
  it('removes override fields from army object', () => {
    const army = {
      game: '40k',
      faction: 'Ultramarines',
      crest: 'UM',
      color: '#1c4fa0',
      crestOverride: 'XX',
      colorOverride: '#ff00ff',
    };
    clearArmyThemeOverrides(army);
    expect(army.crestOverride).toBeUndefined();
    expect(army.colorOverride).toBeUndefined();
    expect(army.crest).toBe('UM');
  });
});
