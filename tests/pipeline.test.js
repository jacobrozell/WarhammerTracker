import { describe, it, expect } from 'vitest';
import {
  resolvePipeline,
  stateProgress,
  progressSegments,
  collectionProgress,
  buildStateHexMap,
  buildPipelineIndex,
  normalizeState,
  modelCount,
} from '../js/core/pipeline.js';
import { DEFAULT_PIPELINE } from '../js/core/constants.js';

describe('resolvePipeline', () => {
  it('returns default pipeline when custom is null or empty', () => {
    expect(resolvePipeline(null)).toEqual(DEFAULT_PIPELINE);
    expect(resolvePipeline([])).toEqual(DEFAULT_PIPELINE);
  });

  it('fills missing hex on custom stages', () => {
    const custom = resolvePipeline([{ key: 'Started', hex: '' }]);
    expect(custom[0].hex).toBe('#888');
  });
});

describe('stateProgress', () => {
  it('returns 0 for first stage and 1 for last', () => {
    const pipeline = resolvePipeline(null);
    const first = pipeline[0].key;
    const last = pipeline[pipeline.length - 1].key;
    expect(stateProgress(first, pipeline)).toBe(0);
    expect(stateProgress(last, pipeline)).toBe(1);
  });

  it('returns 0 for unknown states', () => {
    const pipeline = resolvePipeline(null);
    expect(stateProgress('NotARealState', pipeline)).toBe(0);
  });
});

describe('progressSegments', () => {
  it('weights segments by model count', () => {
    const pipeline = resolvePipeline(null);
    const units = [
      { state: pipeline[0].key, unit: 'A', qty: 1 },
      { state: pipeline[0].key, unit: 'B (5)', qty: 1 },
      { state: pipeline[pipeline.length - 1].key, unit: 'C', qty: 1 },
    ];
    const seg = progressSegments(units, pipeline);
    expect(seg).toHaveLength(2);
    expect(seg[0].pct).toBeCloseTo(85.71, 1);
    expect(seg[1].pct).toBeCloseTo(14.29, 1);
  });
});

describe('collectionProgress', () => {
  it('weights progress by models', () => {
    const pipeline = resolvePipeline(null);
    const last = pipeline[pipeline.length - 1].key;
    const units = [
      { state: pipeline[0].key, unit: 'Big (10)', qty: 1 },
      { state: last, unit: 'Done', qty: 1 },
    ];
    expect(collectionProgress(units, pipeline)).toBeGreaterThan(0.08);
    expect(collectionProgress(units, pipeline)).toBeLessThan(0.2);
  });
});

describe('buildStateHexMap / buildPipelineIndex', () => {
  it('indexes pipeline stages by key', () => {
    const pipeline = resolvePipeline(null);
    const idx = buildPipelineIndex(pipeline);
    const hex = buildStateHexMap(pipeline);
    expect(idx['Primed']).toBe(4);
    expect(hex['Primed']).toBe('#f97316');
  });
});

describe('normalizeState', () => {
  it('defaults empty state to first pipeline stage', () => {
    const pipeline = resolvePipeline(null);
    expect(normalizeState('', pipeline).state).toBe(pipeline[0].key);
  });
});

describe('modelCount', () => {
  it('uses qty when unit name has no model count', () => {
    expect(modelCount({ unit: 'Warlock Engineer', qty: 3 })).toBe(3);
  });

  it('defaults qty to 1', () => {
    expect(modelCount({ unit: 'Grey Seer' })).toBe(1);
  });
});
