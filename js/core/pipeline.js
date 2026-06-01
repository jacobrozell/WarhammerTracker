import { DEFAULT_PIPELINE } from './constants.js';
import { hasSquadMembers, eachMemberEffectiveState, modelCount } from './members.js';

export { modelCount };

/** @param {import('./constants.js').PipelineStage[]} pipeline */
export function buildPipelineIndex(pipeline) {
  return Object.fromEntries(pipeline.map((s, i) => [s.key, i]));
}

/** @param {import('./constants.js').PipelineStage[]} pipeline */
export function buildStateHexMap(pipeline) {
  return Object.fromEntries(pipeline.map(s => [s.key, s.hex]));
}

/** @param {import('./constants.js').PipelineStage[]} pipeline */
export function buildStateCanonMap(pipeline) {
  return Object.fromEntries(pipeline.map(s => [s.key.toLowerCase(), s.key]));
}

/**
 * @param {import('./constants.js').PipelineStage[]|null|undefined} custom
 * @returns {import('./constants.js').PipelineStage[]}
 */
export function resolvePipeline(custom) {
  if (!custom?.length) return DEFAULT_PIPELINE.slice();
  return custom.map(s => ({ key: s.key, hex: s.hex || '#888' }));
}

/**
 * @param {string} raw
 * @param {import('./constants.js').PipelineStage[]} pipeline
 */
export function normalizeState(raw, pipeline) {
  const canon = buildStateCanonMap(pipeline);
  const s = String(raw || '').trim();
  if (!s) return { state: pipeline[0]?.key || 'Unassembled' };
  const match = canon[s.toLowerCase()];
  if (match) return { state: match };
  return {
    state: pipeline[0]?.key || 'Unassembled',
    warn: `Unknown state "${s}" — using ${pipeline[0]?.key || 'Unassembled'}`,
  };
}

/** @param {import('./constants.js').PipelineStage[]} pipeline */
export function stateProgress(state, pipeline) {
  const idx = buildPipelineIndex(pipeline);
  const max = Math.max(pipeline.length - 1, 1);
  return (idx[state] ?? 0) / max;
}

/** Weighted progress for one unit (0–1). */
export function unitWeightedProgress(unit, pipeline) {
  if (hasSquadMembers(unit)) {
    return eachMemberEffectiveState(unit).reduce(
      (s, st) => s + stateProgress(st, pipeline),
      0,
    );
  }
  return stateProgress(unit.state, pipeline) * modelCount(unit);
}

/** @param {object[]} units @param {import('./constants.js').PipelineStage[]} pipeline */
export function collectionProgress(units, pipeline) {
  const total = units.reduce((s, u) => s + modelCount(u), 0);
  if (!total) return 0;
  return units.reduce((s, u) => s + unitWeightedProgress(u, pipeline), 0) / total;
}

/** @param {object[]} units @param {import('./constants.js').PipelineStage[]} pipeline */
export function progressSegments(units, pipeline) {
  const totalModels = units.reduce((s, u) => s + modelCount(u), 0);
  if (!totalModels) return [];
  const counts = {};
  units.forEach(u => {
    if (hasSquadMembers(u)) {
      eachMemberEffectiveState(u).forEach(st => {
        counts[st] = (counts[st] || 0) + 1;
      });
    } else {
      const w = modelCount(u);
      counts[u.state] = (counts[u.state] || 0) + w;
    }
  });
  return pipeline
    .filter(p => counts[p.key])
    .map(p => ({ key: p.key, hex: p.hex, pct: (counts[p.key] / totalModels) * 100 }));
}

/** @param {import('./constants.js').Army|null|undefined} [army] @param {import('./constants.js').PipelineStage[]|null|undefined} [custom] */
export function getPipelineForArmy(army, custom) {
  const src = army?.pipeline ?? custom;
  return resolvePipeline(src);
}

/** @param {string} current @param {import('./constants.js').PipelineStage[]} pipeline */
export function nextPipelineState(current, pipeline) {
  const i = pipeline.findIndex(p => p.key === current);
  if (i < 0 || i >= pipeline.length - 1) return null;
  return pipeline[i + 1].key;
}

/**
 * @param {{ settings: import('./constants.js').Settings }} storeRef
 * @param {import('./constants.js').PipelineStage[]} pipeline
 */
export function setCustomPipeline(storeRef, pipeline) {
  storeRef.settings.pipeline = pipeline.map(s => ({ key: s.key, hex: s.hex }));
}
