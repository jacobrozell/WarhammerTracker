import { describe, it, expect } from 'vitest';
import {
  squadSize,
  hasSquadMembers,
  ensureSquadMembers,
  clearSquadMembers,
  memberEffectiveState,
  memberEffectiveNotes,
  setMember,
  resizeSquadMembers,
  squadStateSummary,
  squadGroupKey,
  unitMatchesStateFilter,
  unitPassesQuickView,
} from '../js/core/members.js';
import {
  unitWeightedProgress,
  progressSegments,
  collectionProgress,
} from '../js/core/pipeline.js';
import { resolvePipeline } from '../js/core/pipeline.js';

const pipeline = resolvePipeline(null);
const MAG = 'Magnetising';
const PRIMED = 'Primed';

describe('squad members core', () => {
  it('squadSize uses model count from unit name', () => {
    expect(squadSize({ unit: 'Terminators (5)', qty: 1 })).toBe(5);
    expect(squadSize({ unit: 'Rat Ogors', qty: 3 })).toBe(3);
  });

  it('hasSquadMembers is false until members array is initialized', () => {
    expect(hasSquadMembers({ unit: 'Terminators (5)', state: MAG })).toBe(false);
    const u = { unit: 'Terminators (5)', state: MAG };
    ensureSquadMembers(u);
    expect(hasSquadMembers(u)).toBe(true);
    expect(u.members).toHaveLength(5);
  });

  it('memberEffectiveState inherits squad default when member has no override', () => {
    const u = { unit: 'Terminators (5)', state: MAG, members: [{}, {}, { state: PRIMED }, {}, {}] };
    expect(memberEffectiveState(u, 0)).toBe(MAG);
    expect(memberEffectiveState(u, 2)).toBe(PRIMED);
  });

  it('setMember stores overrides only', () => {
    const u = { unit: 'Terminators (5)', state: MAG };
    ensureSquadMembers(u);
    setMember(u, 2, { state: PRIMED, notes: 'test recipe' });
    expect(u.members[2].state).toBe(PRIMED);
    expect(u.members[2].notes).toBe('test recipe');
    expect(u.members[0].state).toBeUndefined();
  });

  it('resizeSquadMembers grows and shrinks with qty / model count', () => {
    const u = { unit: 'Terminators (5)', qty: 1, state: MAG, members: [{ state: PRIMED }, {}, {}, {}, {}] };
    const u2 = { unit: 'Clanrats (10)', qty: 1, state: MAG, members: Array(10).fill({}) };
    resizeSquadMembers(u2);
    expect(u2.members).toHaveLength(10);
    u.qty = 1;
    u.unit = 'Terminators (3)';
    resizeSquadMembers(u);
    expect(u.members).toHaveLength(3);
    expect(u.members[0].state).toBe(PRIMED);
  });

  it('clearSquadMembers removes tracking', () => {
    const u = { unit: 'Terminators (5)', state: MAG };
    ensureSquadMembers(u);
    clearSquadMembers(u);
    expect(hasSquadMembers(u)).toBe(false);
    expect(u.members).toBeUndefined();
  });

  it('squadStateSummary describes overrides vs default', () => {
    const u = { unit: 'Terminators (5)', state: MAG, members: [{}, {}, { state: PRIMED }, {}, {}] };
    expect(squadStateSummary(u)).toBe('4× Magnetising, 1× Primed');
  });
});

describe('squad members filters', () => {
  const u = { unit: 'Terminators (5)', state: MAG, members: [{}, {}, { state: PRIMED }, {}, {}] };

  it('unitMatchesStateFilter matches any member effective state', () => {
    expect(unitMatchesStateFilter(u, 'All')).toBe(true);
    expect(unitMatchesStateFilter(u, PRIMED)).toBe(true);
    expect(unitMatchesStateFilter(u, 'Based')).toBe(false);
  });

  it('unitPassesQuickView uses effective member states when squad active', () => {
    expect(unitPassesQuickView(u, pipeline, 'all')).toBe(true);
    expect(unitPassesQuickView(u, pipeline, 'wip')).toBe(true);
    const allPrimed = { unit: 'Terminators (5)', state: PRIMED, members: Array(5).fill({ state: PRIMED }) };
    expect(unitPassesQuickView(allPrimed, pipeline, 'backlog')).toBe(false);
  });

  it('unitPassesQuickView ready matches Based or Done', () => {
    const based = { unit: 'Captain', state: 'Based', qty: 1 };
    const unassembled = { unit: 'Captain', state: pipeline[0].key, qty: 1 };
    expect(unitPassesQuickView(based, pipeline, 'ready')).toBe(true);
    expect(unitPassesQuickView(unassembled, pipeline, 'ready')).toBe(false);
  });
});

describe('squadGroupKey', () => {
  it('treats spearhead flag as part of identity', () => {
    const a = { unit: 'Squad', qty: 1, source: 'Box', state: 'Primed', spearhead: true };
    const b = { unit: 'Squad', qty: 1, source: 'Box', state: 'Primed', spearhead: false };
    expect(squadGroupKey(a, b)).toBe(false);
    expect(squadGroupKey(a, { ...a })).toBe(true);
  });
});

describe('memberEffectiveNotes', () => {
  it('prefers member notes over unit notes', () => {
    const u = {
      unit: 'Terminators (2)', state: 'Primed', notes: 'squad note',
      members: [{ notes: 'model A' }, {}],
    };
    expect(memberEffectiveNotes(u, 0)).toBe('model A');
    expect(memberEffectiveNotes(u, 1)).toBe('squad note');
  });
});

describe('squad members progress', () => {
  it('unitWeightedProgress averages per-model states', () => {
    const u = { unit: 'Terminators (5)', state: MAG, members: [{}, {}, { state: PRIMED }, {}, {}] };
    const solo = { unit: 'Terminators (5)', state: MAG };
    const withMembers = unitWeightedProgress(u, pipeline);
    const without = unitWeightedProgress(solo, pipeline);
    expect(withMembers).toBeGreaterThan(without);
  });

  it('progressSegments splits by member effective state', () => {
    const units = [{
      unit: 'Terminators (5)',
      state: MAG,
      members: [{}, {}, { state: PRIMED }, {}, {}],
    }];
    const seg = progressSegments(units, pipeline);
    expect(seg).toHaveLength(2);
    expect(seg.find(s => s.key === MAG)?.pct).toBeCloseTo(80, 0);
    expect(seg.find(s => s.key === PRIMED)?.pct).toBeCloseTo(20, 0);
  });

  it('collectionProgress weights squads by model count', () => {
    const units = [
      { unit: 'Terminators (5)', state: MAG, members: [{}, {}, { state: PRIMED }, {}, {}] },
      { unit: 'Captain', state: 'Done', qty: 1 },
    ];
    const p = collectionProgress(units, pipeline);
    expect(p).toBeCloseTo(0.417, 2);
    expect(p).toBeLessThan(1);
  });
});
