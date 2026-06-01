import { describe, it, expect } from 'vitest';
import { extractTags } from '../js/core/tags.js';

describe('extractTags', () => {
  it('returns empty array for empty or missing notes', () => {
    expect(extractTags()).toEqual([]);
    expect(extractTags('')).toEqual([]);
  });

  it('extracts hashtags case-insensitively', () => {
    expect(extractTags('WIP #primed and #Basing')).toEqual(['primed', 'basing']);
  });

  it('supports hyphenated tag names', () => {
    expect(extractTags('#spear-head #wip2')).toEqual(['spear-head', 'wip2']);
  });

  it('returns no tags when notes have no hashtags', () => {
    expect(extractTags('primed basecoats, no tags')).toEqual([]);
  });
});
