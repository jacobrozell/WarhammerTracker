import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  DEFAULT_FACTION_PRESETS,
  COMPOSITE_FACTION_PRESETS,
  CANONICAL_FACTIONS,
  FACTION_ALIASES,
  FACTION_DEFS,
  SUPPORTED_GAMES,
  FACTION_PRESET_FALLBACK_COLOR,
  mergeFactionPresets,
  resolveFactionPreset,
  isFallbackPreset,
  getArmyPresentation,
  compositePresetKey,
  syncArmyThemeFromPresets,
  auditFactionContrasts,
  contrastRatio,
} from '../js/data/factions/index.js';
import { DEFAULT_FACTION_PRESETS as PRESETS_FROM_CONSTANTS } from '../js/core/constants.js';
import { importMusterArmies } from '../js/import/muster-armies.js';
import { parseCSV } from '../js/data/csv.js';
import { resolvePipeline } from '../js/core/pipeline.js';
import { safeColor } from '../js/core/dom.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function isValidPreset([crest, color]) {
  return (
    typeof crest === 'string'
    && crest.length > 0
    && crest.length <= 8
    && typeof color === 'string'
    && safeColor(color) === color
    && color !== FACTION_PRESET_FALLBACK_COLOR
  );
}

function uniqueFactionsFromSampleCsv() {
  const rows = parseCSV(readFileSync(join(root, 'warhammer_armies.csv'), 'utf8'));
  const factionCol = rows[0].indexOf('Faction');
  const gameCol = rows[0].indexOf('Game');
  const pairs = [];
  const seen = new Set();
  for (const row of rows.slice(1)) {
    const f = (row[factionCol] || '').trim();
    const g = (row[gameCol] || '').trim();
    const key = `${g}\0${f}`;
    if (f && !seen.has(key)) {
      seen.add(key);
      pairs.push({ game: g, faction: f });
    }
  }
  return pairs;
}

describe('FACTION_DEFS catalogue', () => {
  it('is re-exported unchanged from constants.js', () => {
    expect(PRESETS_FROM_CONSTANTS).toBe(DEFAULT_FACTION_PRESETS);
  });

  it('defines every canonical faction for each supported game', () => {
    for (const names of Object.values(CANONICAL_FACTIONS)) {
      for (const name of names) {
        expect(DEFAULT_FACTION_PRESETS).toHaveProperty(name);
      }
    }
    expect(DEFAULT_FACTION_PRESETS).toHaveProperty('Terrain');
  });

  it('builds composite keys for every def × game', () => {
    for (const d of FACTION_DEFS) {
      for (const game of d.games) {
        const key = compositePresetKey(game, d.label);
        expect(COMPOSITE_FACTION_PRESETS[key]).toEqual([d.crest, d.color]);
      }
    }
  });

  it('uses valid crest length and safe hex colours for every flat entry', () => {
    for (const [name, preset] of Object.entries(DEFAULT_FACTION_PRESETS)) {
      expect(isValidPreset(preset), `invalid preset for "${name}"`).toBe(true);
    }
  });

  it('has unique crests within each game (canonical labels only)', () => {
    for (const [game, labels] of Object.entries(CANONICAL_FACTIONS)) {
      const crests = labels.map(label => COMPOSITE_FACTION_PRESETS[compositePresetKey(game, label)][0]);
      expect(new Set(crests).size, `duplicate crest in ${game}`).toBe(crests.length);
    }
  });
});

describe('mergeFactionPresets', () => {
  it('layers user overrides on top of defaults', () => {
    const merged = mergeFactionPresets({ '40k:Custom': ['XX', '#112233'] });
    expect(merged['40k:Custom']).toEqual(['XX', '#112233']);
    expect(merged['40k:Ultramarines']).toEqual(DEFAULT_FACTION_PRESETS.Ultramarines);
  });

  it('returns full catalogue when overrides are null', () => {
    const merged = mergeFactionPresets(null);
    expect(merged['AoS:Skaven']).toEqual(['SK', '#8a9a4a']);
    expect(merged.Skaven).toEqual(['SK', '#8a9a4a']);
  });
});

describe('resolveFactionPreset', () => {
  it('scopes Skaven by game (AoS vs Blood Bowl)', () => {
    expect(resolveFactionPreset('Skaven', { game: 'AoS' })).toEqual(['SK', '#8a9a4a']);
    expect(resolveFactionPreset('Skaven', { game: 'Blood Bowl' })).toEqual(['SK', '#888']);
    expect(resolveFactionPreset('Blood Bowl: Skaven', { game: 'Blood Bowl' })).toEqual(['BBS', '#8a9a4a']);
  });

  it('scopes Dwarfs by game (TOW vs Blood Bowl)', () => {
    expect(resolveFactionPreset('Dwarfs', { game: 'TOW' })).toEqual(['DWF', '#5a4a35']);
    expect(resolveFactionPreset('Blood Bowl: Dwarfs', { game: 'Blood Bowl' })).toEqual(['BBD', '#5a4a35']);
  });

  it('resolves aliases case-insensitively', () => {
    expect(resolveFactionPreset('grey knights', { game: '40k' })).toEqual(['GK', '#aeb6bd']);
  });

  it('falls back when faction is unknown', () => {
    const hit = resolveFactionPreset('Made Up Legion', { game: '40k' });
    expect(hit).toEqual(['MA', FACTION_PRESET_FALLBACK_COLOR]);
    expect(isFallbackPreset(hit)).toBe(true);
  });
});

describe('FACTION_ALIASES', () => {
  it('maps every alias to a canonical preset', () => {
    for (const [alias, canonical] of Object.entries(FACTION_ALIASES)) {
      expect(DEFAULT_FACTION_PRESETS).toHaveProperty(canonical);
      expect(resolveFactionPreset(alias, { game: '40k' })).toEqual(
        resolveFactionPreset(canonical, { game: '40k' }),
      );
    }
  });

  it('does not treat game names as faction aliases', () => {
    expect(FACTION_ALIASES).not.toHaveProperty('Old World');
  });
});

describe('getArmyPresentation', () => {
  it('uses live presets over stale stored colours', () => {
    const army = {
      game: '40k',
      faction: 'Ultramarines',
      crest: 'OLD',
      color: '#000000',
    };
    const { crest, color } = getArmyPresentation(army, null);
    expect(crest).toBe('UM');
    expect(color).toBe('#1c4fa0');
  });

  it('respects per-army overrides', () => {
    const army = {
      game: '40k',
      faction: 'Ultramarines',
      crest: 'UM',
      color: '#1c4fa0',
      crestOverride: 'MC',
      colorOverride: '#ff00ff',
    };
    expect(getArmyPresentation(army, null)).toEqual({ crest: 'MC', color: '#ff00ff' });
  });
});

describe('CANONICAL_FACTIONS & SUPPORTED_GAMES', () => {
  it('lists the same game keys', () => {
    expect(Object.keys(CANONICAL_FACTIONS).sort()).toEqual([...SUPPORTED_GAMES].sort());
  });
});

describe('auditFactionContrasts', () => {
  it('computes contrast ratios for known colours', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
    expect(contrastRatio('#1c4fa0', '#15171e')).toBeGreaterThan(2);
  });

  it('returns structured issues below threshold', () => {
    const issues = auditFactionContrasts(3);
    expect(Array.isArray(issues)).toBe(true);
    if (issues.length) {
      expect(issues[0]).toMatchObject({
        label: expect.any(String),
        game: expect.any(String),
        theme: expect.stringMatching(/^(dark|light)$/),
        ratio: expect.any(Number),
        color: expect.stringMatching(/^#/),
      });
    }
  });
});

describe('syncArmyThemeFromPresets', () => {
  it('clears overrides and refreshes snapshot fields', () => {
    const army = {
      game: '40k',
      faction: 'Ultramarines',
      crest: 'OLD',
      color: '#000000',
      crestOverride: 'XX',
      colorOverride: '#ff00ff',
    };
    syncArmyThemeFromPresets(army, null);
    expect(army.crestOverride).toBeUndefined();
    expect(army.colorOverride).toBeUndefined();
    expect(army.crest).toBe('UM');
    expect(army.color).toBe('#1c4fa0');
  });
});


describe('importMusterArmies ↔ faction presets', () => {
  const ctx = { pipeline: resolvePipeline(null), factionPresets: null };

  it('applies game-scoped presets on import', () => {
    const rows = [
      ['Game', 'Faction', 'Army', 'Unit'],
      ['40k', 'Ultramarines', '2nd Company', 'Intercessors'],
    ];
    const result = importMusterArmies(rows, ctx);
    expect(result.data[0].crest).toBe('UM');
    expect(result.data[0].color).toBe('#1c4fa0');
  });

  it('warns on unknown faction for a game', () => {
    const rows = [
      ['Game', 'Faction', 'Army', 'Unit'],
      ['40k', 'Made Up Legion', 'Test', 'Unit'],
    ];
    const result = importMusterArmies(rows, ctx);
    expect(result.ok).toBe(true);
    expect(result.warnings.some(w => w.includes('Unknown faction'))).toBe(true);
    expect(result.data[0].color).toBe(FACTION_PRESET_FALLBACK_COLOR);
  });

  it('links every game+faction in warhammer_armies.csv to a preset', () => {
    for (const { game, faction } of uniqueFactionsFromSampleCsv()) {
      const hit = resolveFactionPreset(faction, { game });
      expect(isFallbackPreset(hit), `no preset for ${game} / ${faction}`).toBe(false);
    }
  });
});
