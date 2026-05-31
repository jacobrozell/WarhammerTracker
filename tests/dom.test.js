import { describe, it, expect } from 'vitest';
import { escapeHtml, escapeAttr, safeColor } from '../js/core/dom.js';

describe('dom', () => {
  it('escapeHtml encodes special characters', () => {
    expect(escapeHtml('<script>"\'&')).toBe('&lt;script&gt;&quot;&#39;&amp;');
  });

  it('escapeAttr matches escapeHtml', () => {
    expect(escapeAttr('a"b')).toBe('a&quot;b');
  });

  it('safeColor allows hex only', () => {
    expect(safeColor('#abc')).toBe('#abc');
    expect(safeColor('red')).toBe('#888');
    expect(safeColor('url(evil)')).toBe('#888');
  });
});
