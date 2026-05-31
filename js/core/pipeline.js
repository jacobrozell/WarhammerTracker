import { DEFAULT_PIPELINE } from './constants.js';

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

/** @param {object[]} units @param {import('./constants.js').PipelineStage[]} pipeline */
export function progressSegments(units, pipeline) {
  const counts = {};
  units.forEach(u => { counts[u.state] = (counts[u.state] || 0) + 1; });
  return pipeline
    .filter(p => counts[p.key])
    .map(p => ({ hex: p.hex, pct: (counts[p.key] / units.length) * 100 }));
}

/** @param {object} unit */
export function modelCount(unit) {
  const m = unit.unit.match(/\(([^)]*)\)/);
  if (m) {
    const n = m[1].match(/\d+/g);
    if (n) return n.reduce((a, b) => a + +b, 0) * (unit.qty || 1);
  }
  return unit.qty || 1;
}

/**
 * @param {{ settings: import('./constants.js').Settings }} storeRef
 * @param {import('./constants.js').PipelineStage[]} pipeline
 */
export function setCustomPipeline(storeRef, pipeline) {
  storeRef.settings.pipeline = pipeline.map(s => ({ key: s.key, hex: s.hex }));
}
