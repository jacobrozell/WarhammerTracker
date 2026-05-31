import { describe, it, expect } from 'vitest';
import { importMusterArmies } from '../js/import/muster-armies.js';
import { resolvePipeline } from '../js/core/pipeline.js';
import { DEFAULT_FACTION_PRESETS } from '../js/core/constants.js';
import { hasSquadMembers } from '../js/core/members.js';

const ctx = { pipeline: resolvePipeline(null), factionPresets: DEFAULT_FACTION_PRESETS };

describe('importMusterArmies squad members', () => {
  it('merges rows with Member column into one unit', () => {
    const rows = [
      ['Game', 'Faction', 'Army', 'Unit', 'Qty', 'Source', 'State', 'Spearhead', 'Notes', 'Member', 'MemberState', 'MemberNotes'],
      ['40k', 'Grey Knights', 'GK', 'Brotherhood Terminators (5)', '1', 'CP', 'Magnetising', '', 'batch', '1', '', ''],
      ['40k', 'Grey Knights', 'GK', 'Brotherhood Terminators (5)', '1', 'CP', 'Magnetising', '', 'batch', '3', 'Primed', 'test basecoat'],
    ];
    const result = importMusterArmies(rows, ctx);
    expect(result.ok).toBe(true);
    expect(result.data[0].units).toHaveLength(1);
    const u = result.data[0].units[0];
    expect(hasSquadMembers(u)).toBe(true);
    expect(u.members).toHaveLength(5);
    expect(u.members[2].state).toBe('Primed');
    expect(u.members[2].notes).toBe('test basecoat');
    expect(u.members[0].state).toBeUndefined();
  });

  it('imports legacy CSV without Member column unchanged', () => {
    const rows = [
      ['Game', 'Faction', 'Army', 'Unit', 'Qty', 'Source', 'State'],
      ['40k', 'Grey Knights', 'GK', 'Strike Squad (5)', '1', '', 'Unassembled'],
    ];
    const result = importMusterArmies(rows, ctx);
    expect(result.data[0].units[0].members).toBeUndefined();
  });
});
