import { describe, it, expect } from 'vitest';
import { parseCSV, serializeCSV } from '../js/data/csv.js';
import { importMusterArmies } from '../js/import/muster-armies.js';
import { importMusterPaints } from '../js/import/muster-paints.js';
import { resolvePipeline } from '../js/core/pipeline.js';
import { DEFAULT_FACTION_PRESETS } from '../js/core/constants.js';
import { armiesToExportRows } from './helpers/armies-export-rows.js';

const armyCtx = { pipeline: resolvePipeline(null), factionPresets: DEFAULT_FACTION_PRESETS };

describe('armies CSV round-trip', () => {
  it('re-imports exported collection with same armies and units', () => {
    const rows = [
      ['Game', 'Faction', 'Army', 'Unit', 'Qty', 'Source', 'State', 'Spearhead', 'Notes'],
      ['40k', 'Ultramarines', '2nd Co', 'Intercessors', '1', 'Box', 'Primed', 'Yes', '#wip'],
      ['40k', 'Ultramarines', '2nd Co', 'Captain', '1', '', 'Based', 'No', ''],
      ['AoS', 'Skaven', 'Vermindoom', 'Clanrats (20)', '2', 'Box', 'Unassembled', '', ''],
    ];
    const first = importMusterArmies(rows, armyCtx);
    expect(first.ok).toBe(true);

    const csv = serializeCSV(armiesToExportRows(first.data, DEFAULT_FACTION_PRESETS));
    const second = importMusterArmies(parseCSV(csv), armyCtx);

    expect(second.ok).toBe(true);
    expect(second.data).toHaveLength(first.data.length);
    expect(second.stats.armies).toBe(first.stats.armies);
    expect(second.stats.units).toBe(first.stats.units);

    const byArmy = name => second.data.find(a => a.army === name);
    expect(byArmy('2nd Co').units).toHaveLength(2);
    expect(byArmy('2nd Co').units[0].spearhead).toBe(true);
    expect(byArmy('2nd Co').units[0].notes).toBe('#wip');
    expect(byArmy('Vermindoom').units[0].qty).toBe(2);
  });

  it('round-trips squad member rows', () => {
    const rows = [
      ['Game', 'Faction', 'Army', 'Unit', 'Qty', 'Member', 'MemberState', 'MemberNotes'],
      ['40k', 'Grey Knights', 'Strike', 'Terminators (2)', '1', '1', 'Primed', ''],
      ['40k', 'Grey Knights', 'Strike', 'Terminators (2)', '1', '2', '', 'leader'],
    ];
    const first = importMusterArmies(rows, armyCtx);
    expect(first.ok).toBe(true);
    expect(first.data[0].units[0].members).toHaveLength(2);

    const csv = serializeCSV(armiesToExportRows(first.data, DEFAULT_FACTION_PRESETS));
    const second = importMusterArmies(parseCSV(csv), armyCtx);

    expect(second.ok).toBe(true);
    expect(second.data[0].units[0].members[1].notes).toBe('leader');
  });
});

describe('paints CSV round-trip', () => {
  it('re-imports minimal paint export', () => {
    const rows = [
      ['Name', 'Type', 'Brand', 'Source', 'Quantity', 'Notes'],
      ['Macragge Blue', 'Base', 'Citadel', 'Set', '2', 'favourite'],
    ];
    const first = importMusterPaints(rows);
    const csv = serializeCSV([
      ['Name', 'Type', 'Brand', 'Source', 'Quantity', 'Notes'],
      ['Macragge Blue', 'Base', 'Citadel', 'Set', '2', 'favourite'],
    ]);
    const second = importMusterPaints(parseCSV(csv));
    expect(second.ok).toBe(true);
    expect(second.data[0].name).toBe('Macragge Blue');
    expect(second.data[0].qty).toBe(2);
    expect(second.data[0].notes).toBe('favourite');
    expect(first.data[0].swatch).toBe(second.data[0].swatch);
  });
});
