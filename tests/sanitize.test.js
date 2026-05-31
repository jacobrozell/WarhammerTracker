import { describe, it, expect } from 'vitest';
import { parseBackup, sanitizeAppState, validateStateLimits } from '../js/data/sanitize.js';
import { MAX_ARMIES } from '../js/core/limits.js';

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
});
