import { describe, it, expect } from 'vitest';
import {
  parseHexColor,
  relativeLuminance,
  contrastRatio,
} from '../js/data/factions/contrast.js';

describe('parseHexColor', () => {
  it('expands 3-digit hex', () => {
    expect(parseHexColor('#abc')).toEqual([170, 187, 204]);
  });

  it('parses 6-digit hex', () => {
    expect(parseHexColor('#1c4fa0')).toEqual([28, 79, 160]);
  });

  it('returns null for invalid input', () => {
    expect(parseHexColor('red')).toBeNull();
    expect(parseHexColor('')).toBeNull();
  });
});

describe('relativeLuminance', () => {
  it('is higher for white than black', () => {
    expect(relativeLuminance([255, 255, 255])).toBeGreaterThan(relativeLuminance([0, 0, 0]));
  });
});

describe('contrastRatio', () => {
  it('returns 0 when colours are invalid', () => {
    expect(contrastRatio('not-a-color', '#000000')).toBe(0);
  });

  it('matches known black/white contrast', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
  });
});
