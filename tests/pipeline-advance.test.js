import { describe, it, expect } from 'vitest';
import { resolvePipeline, nextPipelineState, getPipelineForArmy } from '../js/core/pipeline.js';

describe('nextPipelineState', () => {
  const pipeline = resolvePipeline(null);

  it('returns the next stage key', () => {
    expect(nextPipelineState('Primed', pipeline)).toBe('Base Coated');
  });

  it('returns null at the last stage', () => {
    const last = pipeline[pipeline.length - 1].key;
    expect(nextPipelineState(last, pipeline)).toBeNull();
  });

  it('returns null for unknown current state', () => {
    expect(nextPipelineState('Not Real', pipeline)).toBeNull();
  });
});

describe('getPipelineForArmy', () => {
  it('uses army pipeline when set', () => {
    const custom = [{ key: 'Built', hex: '#fff' }, { key: 'Done', hex: '#0f0' }];
    const army = { army: 'T', game: '40k', faction: 'X', crest: 'T', color: '#888', pipeline: custom, units: [] };
    expect(getPipelineForArmy(army, null).map(s => s.key)).toEqual(['Built', 'Done']);
  });

  it('falls back to global custom pipeline', () => {
    const global = [{ key: 'WIP', hex: '#111' }, { key: 'Done', hex: '#0f0' }];
    const army = { army: 'T', game: '40k', faction: 'X', crest: 'T', color: '#888', units: [] };
    expect(getPipelineForArmy(army, global).map(s => s.key)).toEqual(['WIP', 'Done']);
  });
});
