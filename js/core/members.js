import { DONE_STATES } from './constants.js';

/** @typedef {{ state?: string, notes?: string }} SquadMember */

/** @param {object} unit */
export function modelCount(unit) {
  const m = unit.unit.match(/\(([^)]*)\)/);
  if (m) {
    const n = m[1].match(/\d+/g);
    if (n) return n.reduce((a, b) => a + +b, 0) * (unit.qty || 1);
  }
  return unit.qty || 1;
}

/** @param {object} unit */
export function squadSize(unit) {
  return modelCount(unit);
}

/** @param {object} unit */
export function hasSquadMembers(unit) {
  return Array.isArray(unit.members) && unit.members.length > 0;
}

/** @param {object} unit */
export function ensureSquadMembers(unit) {
  const n = squadSize(unit);
  if (n < 2) return false;
  if (!Array.isArray(unit.members)) unit.members = [];
  while (unit.members.length < n) unit.members.push({});
  if (unit.members.length > n) unit.members.length = n;
  return true;
}

/** @param {object} unit */
export function clearSquadMembers(unit) {
  delete unit.members;
}

/** @param {object} unit */
export function resizeSquadMembers(unit) {
  if (!hasSquadMembers(unit)) return;
  const n = squadSize(unit);
  while (unit.members.length < n) unit.members.push({});
  if (unit.members.length > n) unit.members.length = n;
}

/**
 * @param {object} unit
 * @param {number} index
 * @param {Partial<SquadMember>} patch
 */
export function setMember(unit, index, patch) {
  if (!hasSquadMembers(unit)) ensureSquadMembers(unit);
  if (!unit.members || index < 0 || index >= unit.members.length) return false;
  const m = unit.members[index];
  if ('state' in patch) {
    if (patch.state) m.state = patch.state;
    else delete m.state;
  }
  if ('notes' in patch) {
    if (patch.notes) m.notes = patch.notes;
    else delete m.notes;
  }
  return true;
}

/** @param {object} unit @param {number} index */
export function memberEffectiveState(unit, index) {
  if (hasSquadMembers(unit) && unit.members[index]) {
    const s = unit.members[index].state;
    if (s) return s;
  }
  return unit.state || '';
}

/** @param {object} unit @param {number} index */
export function memberEffectiveNotes(unit, index) {
  if (hasSquadMembers(unit) && unit.members[index]?.notes) return unit.members[index].notes;
  return unit.notes || '';
}

/** @param {object} unit */
export function eachMemberEffectiveState(unit) {
  const n = hasSquadMembers(unit) ? unit.members.length : squadSize(unit);
  const out = [];
  for (let i = 0; i < n; i++) out.push(memberEffectiveState(unit, i));
  return out;
}

/** @param {object} unit */
export function squadStateSummary(unit) {
  if (!hasSquadMembers(unit)) return '';
  const counts = {};
  eachMemberEffectiveState(unit).forEach(s => {
    counts[s] = (counts[s] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k, n]) => `${n}× ${k}`)
    .join(', ');
}

/** @param {object} unit @param {string} filter */
export function unitMatchesStateFilter(unit, filter) {
  if (filter === 'All') return true;
  if (!hasSquadMembers(unit)) return unit.state === filter;
  return eachMemberEffectiveState(unit).some(s => s === filter);
}

/**
 * @param {object} unit
 * @param {import('./constants.js').PipelineStage[]} pipeline
 * @param {string} quickView
 */
export function unitPassesQuickView(unit, pipeline, quickView) {
  if (quickView === 'all') return true;
  const states = hasSquadMembers(unit)
    ? eachMemberEffectiveState(unit)
    : [unit.state];
  if (quickView === 'backlog') return states.some(s => s === pipeline[0]?.key);
  if (quickView === 'wip') {
    return states.some(s => !DONE_STATES.includes(s) && s !== pipeline[0]?.key);
  }
  if (quickView === 'ready') return states.some(s => DONE_STATES.includes(s));
  return true;
}

/** @param {object} a @param {object} b */
export function squadGroupKey(a, b) {
  const spear = (u) => (u.spearhead === undefined ? '' : String(u.spearhead));
  return a.unit === b.unit
    && (a.source || '') === (b.source || '')
    && (a.qty || 1) === (b.qty || 1)
    && spear(a) === spear(b);
}
