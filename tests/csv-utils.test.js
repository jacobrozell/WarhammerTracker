import { describe, it, expect, beforeEach, vi } from 'vitest';
import { headerMap, normalizeQty, normalizeBool } from '../js/data/csv.js';

describe('headerMap', () => {
  it('maps columns case-insensitively', () => {
    const hm = headerMap([['Game', 'Army', 'Unit']], ['game', 'army', 'unit']);
    expect(hm.ok).toBe(true);
    expect(hm.col('game')).toBe(0);
    expect(hm.col('army')).toBe(1);
    expect(hm.col('unit')).toBe(2);
  });

  it('reports missing required columns', () => {
    const hm = headerMap([['Game', 'Unit']], ['game', 'faction', 'army', 'unit']);
    expect(hm.ok).toBe(false);
    expect(hm.error).toContain('faction');
    expect(hm.error).toContain('army');
  });

  it('rejects empty files', () => {
    expect(headerMap([], ['name']).ok).toBe(false);
    expect(headerMap([], ['name']).error).toBe('File is empty');
  });
});

describe('normalizeQty', () => {
  it('defaults empty values to 1', () => {
    expect(normalizeQty('').qty).toBe(1);
    expect(normalizeQty(undefined).qty).toBe(1);
  });

  it('parses valid integers', () => {
    expect(normalizeQty('3').qty).toBe(3);
    expect(normalizeQty(5).qty).toBe(5);
  });

  it('warns and falls back on invalid values', () => {
    const r = normalizeQty('abc');
    expect(r.qty).toBe(1);
    expect(r.warn).toContain('Invalid Qty');
  });

  it('rejects negative and fractional quantities', () => {
    expect(normalizeQty('-1').warn).toBeTruthy();
    expect(normalizeQty('2.5').warn).toBeTruthy();
  });

  it('respects custom default', () => {
    expect(normalizeQty('', 0).qty).toBe(0);
  });

  it('rejects zero when default is positive', () => {
    const r = normalizeQty('0');
    expect(r.qty).toBe(1);
    expect(r.warn).toContain('cannot be 0');
  });
});

describe('normalizeBool', () => {
  it('parses truthy values', () => {
    expect(normalizeBool('Yes').val).toBe(true);
    expect(normalizeBool('y').val).toBe(true);
    expect(normalizeBool('TRUE').val).toBe(true);
    expect(normalizeBool('1').val).toBe(true);
  });

  it('parses falsy values', () => {
    expect(normalizeBool('No').val).toBe(false);
    expect(normalizeBool('n').val).toBe(false);
    expect(normalizeBool('false').val).toBe(false);
    expect(normalizeBool('0').val).toBe(false);
  });

  it('returns undefined for empty input', () => {
    expect(normalizeBool('').val).toBeUndefined();
  });

  it('warns on unrecognised values', () => {
    const r = normalizeBool('maybe');
    expect(r.val).toBeUndefined();
    expect(r.warn).toContain('Unrecognised boolean');
  });
});
