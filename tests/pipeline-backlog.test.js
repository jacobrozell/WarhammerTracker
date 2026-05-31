import { describe, it, expect } from 'vitest';
import {
  progressSegments,
  collectionProgress,
  modelCount,
  resolvePipeline,
} from '../js/core/pipeline.js';

describe('pipeline — backlog (todo: model-weighted progress)', () => {
  const pipeline = resolvePipeline(null);

  it('progressSegments includes stage keys for legend labels', () => {
    const units = [
      { state: pipeline[0].key, unit: 'A', qty: 1 },
      { state: pipeline[1].key, unit: 'B', qty: 1 },
    ];
    const seg = progressSegments(units, pipeline);
    expect(seg.every(s => s.key && s.hex && s.pct > 0)).toBe(true);
    expect(seg.reduce((n, s) => n + s.pct, 0)).toBeCloseTo(100, 5);
  });

  it('collectionProgress returns 0 for empty units', () => {
    expect(collectionProgress([], pipeline)).toBe(0);
  });

  it('modelCount parses parenthetical counts times qty', () => {
    expect(modelCount({ unit: 'Clanrats (20)', qty: 2 })).toBe(40);
  });

  it('collectionProgress is higher when more models are complete', () => {
    const last = pipeline[pipeline.length - 1].key;
    const early = [
      { state: pipeline[0].key, unit: 'Big (10)', qty: 1 },
      { state: pipeline[0].key, unit: 'Small', qty: 1 },
    ];
    const late = [
      { state: last, unit: 'Big (10)', qty: 1 },
      { state: last, unit: 'Small', qty: 1 },
    ];
    expect(collectionProgress(late, pipeline)).toBeGreaterThan(collectionProgress(early, pipeline));
  });
});
