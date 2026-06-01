import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseCSV } from '../js/data/csv.js';
import { detectMusterArmies, detectMusterPaints } from '../js/data/schema.js';
import { importMusterArmies } from '../js/import/muster-armies.js';
import { importMusterPaints } from '../js/import/muster-paints.js';
import { runImport, detectImporter } from '../js/import/registry.js';
import { resolvePipeline } from '../js/core/pipeline.js';
import { DEFAULT_FACTION_PRESETS, DEFAULT_PAINT_TYPES } from '../js/core/constants.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadSample(name) {
  return parseCSV(readFileSync(join(root, name), 'utf8'));
}

describe('schema detection', () => {
  it('detects muster armies headers', () => {
    const rows = [['Game', 'Faction', 'Army', 'Unit']];
    expect(detectMusterArmies(rows)).toBe(true);
    expect(detectMusterPaints(rows)).toBe(false);
  });

  it('detects muster paints headers', () => {
    const rows = [['Name', 'Type', 'Quantity']];
    expect(detectMusterPaints(rows)).toBe(true);
    expect(detectMusterArmies(rows)).toBe(false);
  });

  it('detects minimal paints CSV with Name only', () => {
    expect(detectMusterPaints([['Name']])).toBe(true);
    expect(detectMusterPaints([['Name'], ['Macragge Blue']])).toBe(true);
  });

  it('detects armies headers case-insensitively', () => {
    expect(detectMusterArmies([['GAME', 'Army', 'Unit']])).toBe(true);
    expect(detectMusterArmies([['Game', 'ARMY', 'unit']])).toBe(true);
  });

  it('does not detect armies when unit column is missing', () => {
    expect(detectMusterArmies([['Game', 'Faction', 'Army']])).toBe(false);
  });
});

describe('importMusterArmies', () => {
  const ctx = { pipeline: resolvePipeline(null), factionPresets: DEFAULT_FACTION_PRESETS };

  it('imports sample armies CSV', () => {
    const rows = loadSample('warhammer_armies.csv');
    const result = importMusterArmies(rows, ctx);
    expect(result.ok).toBe(true);
    expect(result.stats.armies).toBeGreaterThan(0);
    expect(result.stats.units).toBeGreaterThan(result.stats.armies);
  });

  it('groups units under the same army', () => {
    const rows = [
      ['Game', 'Faction', 'Army', 'Unit', 'Qty', 'Source', 'State', 'Spearhead', 'Notes'],
      ['AoS', 'Skaven', 'Vermindoom', 'Clanrats (20)', '1', '', 'Primed', 'Yes', ''],
      ['AoS', 'Skaven', 'Vermindoom', 'Grey Seer', '1', '', 'Based', 'No', 'leader'],
    ];
    const result = importMusterArmies(rows, ctx);
    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].units).toHaveLength(2);
    expect(result.data[0].crest).toBe('SK');
    expect(result.data[0].color).toBe(DEFAULT_FACTION_PRESETS.Skaven[1]);
  });

  it('normalises spearhead booleans', () => {
    const rows = [
      ['Game', 'Faction', 'Army', 'Unit', 'Spearhead'],
      ['40k', 'Ultramarines', 'My Chapter', 'Intercessors', 'Yes'],
    ];
    const result = importMusterArmies(rows, ctx);
    expect(result.data[0].units[0].spearhead).toBe(true);
  });

  it('errors on missing required columns', () => {
    const result = importMusterArmies([['Game', 'Unit']], ctx);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('Missing required columns');
  });

  it('errors when no unit rows exist', () => {
    const rows = [['Game', 'Faction', 'Army', 'Unit']];
    const result = importMusterArmies(rows, ctx);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('No unit rows found');
  });

  it('imports optional Crest and Color columns as overrides', () => {
    const rows = [
      ['Game', 'Faction', 'Army', 'Unit', 'Crest', 'Color'],
      ['40k', 'Ultramarines', 'Custom', 'Squad', 'XX', '#ff00ff'],
    ];
    const result = importMusterArmies(rows, ctx);
    expect(result.ok).toBe(true);
    expect(result.data[0].crestOverride).toBe('XX');
    expect(result.data[0].colorOverride).toBe('#ff00ff');
  });

  it('warns on conflicting game for same army', () => {
    const rows = [
      ['Game', 'Faction', 'Army', 'Unit'],
      ['AoS', 'Skaven', 'Mixed', 'Unit A'],
      ['40k', 'Skaven', 'Mixed', 'Unit B'],
    ];
    const result = importMusterArmies(rows, ctx);
    expect(result.ok).toBe(true);
    expect(result.warnings.some(w => w.includes('Game'))).toBe(true);
  });
});

describe('importMusterPaints', () => {
  it('imports sample paints CSV', () => {
    const rows = loadSample('warhammer_paint_inventory.csv');
    const result = importMusterPaints(rows);
    expect(result.ok).toBe(true);
    expect(result.stats.paints).toBeGreaterThan(0);
  });

  it('assigns swatch from paint type', () => {
    const rows = [
      ['Name', 'Type', 'Brand', 'Source', 'Quantity', 'Notes'],
      ['Macragge Blue', 'Base', 'Citadel', '', '1', ''],
    ];
    const result = importMusterPaints(rows);
    expect(result.data[0].swatch).toBe(DEFAULT_PAINT_TYPES.Base);
  });

  it('errors when no paint rows exist', () => {
    const result = importMusterPaints([['Name', 'Type', 'Quantity']]);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('No paint rows found');
  });

  it('imports minimal Name-only CSV', () => {
    const result = importMusterPaints([['Name'], ['Retributor Armour']]);
    expect(result.ok).toBe(true);
    expect(result.data[0].name).toBe('Retributor Armour');
  });

  it('merges duplicate paint names on import', () => {
    const rows = [
      ['Name', 'Type', 'Quantity'],
      ['Same Blue', 'Base', '1'],
      ['same blue', 'Base', '2'],
    ];
    const result = importMusterPaints(rows);
    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].qty).toBe(3);
    expect(result.warnings.some(w => w.includes('Merged duplicate'))).toBe(true);
  });
});

describe('import registry', () => {
  it('selects importer by expected domain', () => {
    const armyRows = [['Game', 'Army', 'Unit']];
    expect(detectImporter(armyRows, 'armies')?.domain).toBe('armies');
    expect(detectImporter(armyRows, 'paints')).toBeNull();
  });

  it('rejects armies CSV when paints import is expected', () => {
    const armyRows = [
      ['Game', 'Faction', 'Army', 'Unit'],
      ['40k', 'Ultramarines', 'My Chapter', 'Intercessors'],
    ];
    const result = runImport(armyRows, {}, 'paints');
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('Unrecognised paints CSV');
  });

  it('reports unrecognised format', () => {
    const result = runImport([['Foo', 'Bar']], {}, 'armies');
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('Unrecognised');
  });
});
