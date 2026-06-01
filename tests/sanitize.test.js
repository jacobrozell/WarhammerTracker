import { describe, it, expect } from 'vitest';
import { parseBackup, sanitizeAppState, validateStateLimits } from '../js/data/sanitize.js';
import {
  MAX_ARMIES,
  MAX_PAINTS,
  MAX_UNITS_PER_ARMY,
  MAX_UNITS_TOTAL,
  MAX_IMPORT_BYTES,
} from '../js/core/limits.js';
import { DEFAULT_SETTINGS } from '../js/core/constants.js';

describe('sanitize', () => {
  it('rejects unknown backup fields', () => {
    const result = parseBackup(JSON.stringify({ version: 3, collection: [], paints: [], evil: true }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Unknown backup fields/);
  });

  it('rejects invalid JSON', () => {
    const result = parseBackup('{not json');
    expect(result.ok).toBe(false);
  });

  it('sanitizes pipeline hex colors', () => {
    const result = sanitizeAppState({
      collection: [],
      paints: [],
      settings: { pipeline: [{ key: 'Done', hex: 'javascript:alert(1)' }] },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.settings.pipeline?.[0].hex).toBe('#888');
    }
  });

  it('caps string lengths', () => {
    const long = 'x'.repeat(1000);
    const result = sanitizeAppState({
      collection: [{ army: long, game: 'g', faction: 'f', crest: 'XX', color: '#fff', units: [] }],
      paints: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.collection[0].army.length).toBeLessThanOrEqual(500);
  });

  it('enforces army count limits on import', () => {
    const armies = Array.from({ length: MAX_ARMIES + 1 }, (_, i) => ({
      army: `A${i}`, game: 'g', faction: 'f', crest: 'XX', color: '#fff', units: [],
    }));
    const result = parseBackup(JSON.stringify({ version: 3, collection: armies, paints: [] }));
    expect(result.ok).toBe(false);
  });

  it('sanitizes squad members on units', () => {
    const result = sanitizeAppState({
      collection: [{
        army: 'GK', game: '40k', faction: 'GK', crest: 'GK', color: '#111',
        units: [{
          unit: 'Terminators (5)', qty: 1, state: 'Magnetising',
          members: [{}, { state: 'Primed', notes: 'test' }],
        }],
      }],
      paints: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.collection[0].units[0].members).toHaveLength(2);
      expect(result.state.collection[0].units[0].members[1].state).toBe('Primed');
    }
  });

  it('returns preview counts', () => {
    const json = JSON.stringify({
      version: 3,
      collection: [{
        army: 'Test', game: '40k', faction: 'UM', crest: 'T', color: '#111',
        units: [{ unit: 'Marines', qty: 1, state: 'Done' }],
      }],
      paints: [{ name: 'Red', type: 'Base', swatch: '#f00' }],
    });
    const result = parseBackup(json);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.preview).toBe('1 armies (1 unit entries), 1 paints');
  });

  it('validateStateLimits passes for normal data', () => {
    const result = sanitizeAppState({
      collection: [{ army: 'A', game: 'g', faction: 'f', crest: 'A', color: '#111', units: [] }],
      paints: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(validateStateLimits(result.state)).toBeNull();
  });

  it('rejects backup over byte limit', () => {
    const result = parseBackup('{}', { byteLength: MAX_IMPORT_BYTES + 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/MB limit/);
  });

  it('rejects non-object backup root', () => {
    expect(parseBackup('[]').ok).toBe(false);
    expect(parseBackup('null').ok).toBe(false);
  });

  it('ignores invalid theme values', () => {
    const result = sanitizeAppState({
      collection: [],
      paints: [],
      settings: { theme: 'neon-punk' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.settings.theme).toBe(DEFAULT_SETTINGS.theme);
  });

  it('preserves low flag on paints', () => {
    const result = sanitizeAppState({
      collection: [],
      paints: [{ name: 'Nuln Oil', type: 'Wash', swatch: '#111', qty: 1, low: true }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.paints[0].low).toBe(true);
  });

  it('enforces paint count limit on import', () => {
    const paints = Array.from({ length: MAX_PAINTS + 1 }, (_, i) => ({
      name: `P${i}`, type: 'Base', swatch: '#111', qty: 1,
    }));
    const result = parseBackup(JSON.stringify({ version: 3, collection: [], paints }));
    expect(result.ok).toBe(false);
  });

  it('validateStateLimits flags per-army unit overflow', () => {
    const units = Array.from({ length: MAX_UNITS_PER_ARMY + 1 }, (_, i) => ({
      unit: `U${i}`, qty: 1, source: '', state: 'Unassembled',
    }));
    const state = {
      version: 3,
      collection: [{ army: 'Big', game: 'g', faction: 'f', crest: 'B', color: '#111', units }],
      paints: [],
      settings: structuredClone(DEFAULT_SETTINGS),
    };
    expect(validateStateLimits(state)).toMatch(/exceeds.*unit entries/);
  });

  it('validateStateLimits flags total unit overflow across armies', () => {
    const chunk = Array.from({ length: MAX_UNITS_PER_ARMY }, () => ({
      unit: 'U', qty: 1, source: '', state: 'Unassembled',
    }));
    const armies = Array.from({ length: Math.ceil((MAX_UNITS_TOTAL + 1) / MAX_UNITS_PER_ARMY) }, (_, i) => ({
      army: `A${i}`, game: 'g', faction: 'f', crest: 'A', color: '#111', units: chunk,
    }));
    const result = sanitizeAppState({ collection: armies, paints: [] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(validateStateLimits(result.state)).toMatch(/Too many unit entries/);
    }
  });

  it('allows unknown keys when strictKeys is false', () => {
    const result = parseBackup(
      JSON.stringify({ version: 3, collection: [], paints: [], extra: 1 }),
      { strictKeys: false },
    );
    expect(result.ok).toBe(true);
  });

  it('preserves valid filter and sort settings', () => {
    const result = sanitizeAppState({
      collection: [],
      paints: [],
      settings: {
        gameFilter: '40k',
        armySort: 'progress',
        unitSort: 'state',
        quickView: 'wip',
        tagFilter: 'spearhead',
        spearheadOnly: true,
        collapsedArmies: ['My Army'],
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const s = result.state.settings;
      expect(s.gameFilter).toBe('40k');
      expect(s.armySort).toBe('progress');
      expect(s.unitSort).toBe('state');
      expect(s.quickView).toBe('wip');
      expect(s.tagFilter).toBe('spearhead');
      expect(s.spearheadOnly).toBe(true);
      expect(s.collapsedArmies).toEqual(['My Army']);
    }
  });

  it('ignores invalid sort and quickView values', () => {
    const result = sanitizeAppState({
      collection: [],
      paints: [],
      settings: { armySort: 'random', quickView: 'soon' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.settings.armySort).toBeUndefined();
      expect(result.state.settings.quickView).toBeUndefined();
    }
  });

  it('sanitizes per-army pipeline and theme overrides', () => {
    const result = sanitizeAppState({
      collection: [{
        army: 'A', game: '40k', faction: 'UM', crest: 'A', color: '#111',
        crestOverride: 'XX',
        colorOverride: 'javascript:x',
        pipeline: [{ key: 'Done', hex: '#0f0' }, { key: '', hex: '#000' }],
        units: [],
      }],
      paints: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const army = result.state.collection[0];
      expect(army.crestOverride).toBe('XX');
      expect(army.colorOverride).toBe('#888');
      expect(army.pipeline).toHaveLength(1);
      expect(army.pipeline[0].hex).toBe('#0f0');
    }
  });

  it('sanitizes user faction preset overrides', () => {
    const result = sanitizeAppState({
      collection: [],
      paints: [],
      settings: {
        factionPresets: { '40k:Custom': ['AB', '#112233'], bad: 'nope' },
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.settings.factionPresets).toEqual({ '40k:Custom': ['AB', '#112233'] });
    }
  });
});
