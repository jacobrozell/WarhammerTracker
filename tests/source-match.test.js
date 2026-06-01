import { describe, it, expect } from 'vitest';
import { sourceParts, sourcesMatch } from '../js/core/source-match.js';

describe('sourceParts', () => {
  it('splits compound paint sources on +', () => {
    expect(sourceParts('Starter Set + Combat Patrol')).toEqual(['starter set', 'combat patrol']);
  });

  it('returns empty for blank source', () => {
    expect(sourceParts('')).toEqual([]);
    expect(sourceParts('   ')).toEqual([]);
  });
});

describe('sourcesMatch', () => {
  it('matches when unit source contains a paint source part', () => {
    expect(sourcesMatch('Starter Set', 'Citadel Starter Set box')).toBe(true);
  });

  it('matches when paint source contains unit source', () => {
    expect(sourcesMatch('Combat Patrol + extras', 'combat patrol')).toBe(true);
  });

  it('rejects empty unit source', () => {
    expect(sourcesMatch('Starter Set', '')).toBe(false);
  });

  it('rejects unrelated sources', () => {
    expect(sourcesMatch('Contrast Paint Set', 'Underworlds Warband')).toBe(false);
  });
});
