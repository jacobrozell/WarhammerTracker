import { describe, it, expect } from 'vitest';
import { parseCSV, serializeCSV, escapeCSV } from '../js/data/csv.js';
import { escapeHtml, escapeAttr, safeColor } from '../js/core/dom.js';
import { normalizeState, modelCount, resolvePipeline } from '../js/core/pipeline.js';
import { DEFAULT_PIPELINE } from '../js/core/constants.js';

describe('parseCSV / serializeCSV', () => {
  it('round-trips simple rows', () => {
    const rows = [['Name', 'Qty'], ['Intercessors', '5']];
    const text = serializeCSV(rows);
    expect(parseCSV(text)).toEqual(rows);
  });

  it('handles quoted fields with commas and newlines', () => {
    const text = 'a,b\n"hello, world","line\nbreak"';
    const rows = parseCSV(text);
    expect(rows[1]).toEqual(['hello, world', 'line\nbreak']);
  });

  it('strips BOM', () => {
    expect(parseCSV('\uFEFFa,b\n1,2')[0]).toEqual(['a', 'b']);
  });
});

describe('escapeCSV', () => {
  it('quotes fields with special characters', () => {
    expect(escapeCSV('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCSV('a,b')).toBe('"a,b"');
  });
});

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>"x"</script>')).toBe('&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
  });

  it('handles null and undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('leaves safe text unchanged', () => {
    expect(escapeHtml('Intercessors (5)')).toBe('Intercessors (5)');
  });
});

describe('escapeAttr', () => {
  it('escapes quotes for attribute contexts', () => {
    expect(escapeAttr('say "hello"')).toBe('say &quot;hello&quot;');
  });
});

describe('safeColor', () => {
  it('allows 3- and 6-digit hex colors', () => {
    expect(safeColor('#1c4fa0')).toBe('#1c4fa0');
    expect(safeColor('#abc')).toBe('#abc');
  });

  it('rejects unsafe values', () => {
    expect(safeColor('red; background:url(javascript:alert(1))')).toBe('#888');
    expect(safeColor('')).toBe('#888');
  });
});


describe('pipeline', () => {
  it('normalizes state case-insensitively', () => {
    const pipeline = resolvePipeline(null);
    expect(normalizeState('primed', pipeline).state).toBe('Primed');
  });

  it('warns on unknown state', () => {
    const pipeline = resolvePipeline(null);
    const r = normalizeState('Banana', pipeline);
    expect(r.state).toBe(DEFAULT_PIPELINE[0].key);
    expect(r.warn).toBeTruthy();
  });

  it('counts models from unit name', () => {
    expect(modelCount({ unit: 'Clanrats (20)', qty: 1 })).toBe(20);
    expect(modelCount({ unit: 'Clanrats (5+5)', qty: 2 })).toBe(20);
  });
});
