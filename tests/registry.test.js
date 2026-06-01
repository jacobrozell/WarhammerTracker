import { describe, it, expect } from 'vitest';
import { detectImporter, runImport, IMPORTERS } from '../js/import/registry.js';
import { resolvePipeline } from '../js/core/pipeline.js';

const ctx = { pipeline: resolvePipeline(null), factionPresets: null };

describe('import registry', () => {
  it('exports both muster importers', () => {
    expect(IMPORTERS.map(i => i.domain).sort()).toEqual(['armies', 'paints']);
  });

  it('detectImporter returns null for unknown headers', () => {
    expect(detectImporter([['Foo', 'Bar']])).toBeNull();
    expect(detectImporter([['Foo', 'Bar']], 'armies')).toBeNull();
  });

  it('detectImporter prefers domain when multiple formats match', () => {
    const ambiguous = [['Name', 'Game', 'Army', 'Unit']];
    expect(detectImporter(ambiguous, 'paints')?.domain).toBe('paints');
    expect(detectImporter(ambiguous, 'armies')?.domain).toBe('armies');
  });

  it('runImport with paints domain rejects army-only CSV', () => {
    const armyRows = [
      ['Game', 'Faction', 'Army', 'Unit'],
      ['40k', 'Ultramarines', 'Chapter', 'Intercessors'],
    ];
    const result = runImport(armyRows, ctx, 'paints');
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('Unrecognised paints CSV');
  });

  it('runImport succeeds for paints without expected domain', () => {
    const rows = [['Name', 'Type'], ['Blue', 'Base']];
    const result = runImport(rows, ctx);
    expect(result.ok).toBe(true);
    expect(result.data[0].name).toBe('Blue');
  });
});
