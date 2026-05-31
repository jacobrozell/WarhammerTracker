import {
  getState,
  getPipeline,
  getArmyPipeline,
  getCollapsedArmies,
  setCollapsedArmies,
  patchSettings,
  pushUndoBatchStates,
  updateUnit,
  removeUnit,
  addUnit,
  addArmy,
  removeArmy,
  renameArmy,
  reapplyArmyFactionDefaults,
  duplicateUnit,
  moveUnit,
  mergeArmyDuplicates,
  beginBatch,
  endBatch,
  undoLast,
} from '../core/store.js';
import {
  modelCount,
  collectionProgress,
  progressSegments,
  buildStateHexMap,
} from '../core/pipeline.js';
import { DONE_STATES } from '../core/constants.js';
import {
  CANONICAL_FACTIONS,
  SUPPORTED_GAMES,
  getArmyPresentation,
} from '../data/faction-presets.js';
import { escapeHtml, escapeAttr, safeColor } from '../core/dom.js';
import { wireDropZone } from '../ui/dropzone.js';
import { downloadTemplate } from '../data/export.js';
import { toast } from '../ui/toast.js';
import { confirmDialog } from '../ui/confirm.js';
import { formDialog } from '../ui/form-modal.js';
import { openArmyPipelineSettings } from '../ui/settings-panel.js';

/** @type {string} */
let gameFilter = 'All';
/** @type {string} */
let factionFilter = 'All';
/** @type {string} */
let searchTerm = '';
/** @type {string} */
let stateFilter = 'All';
/** @type {string} */
let sourceFilter = 'All';
/** @type {boolean} */
let spearheadOnly = false;
/** @type {string} */
let quickView = 'all';
/** @type {string} */
let tagFilter = 'All';
/** @type {string} */
let armySort = 'csv';
/** @type {string} */
let unitSort = 'name';

let filterPrefsLoaded = false;

function ensureFilterPrefs() {
  if (filterPrefsLoaded) return;
  filterPrefsLoaded = true;
  const s = getState().settings;
  if (s.gameFilter) gameFilter = s.gameFilter;
  if (s.factionFilter) factionFilter = s.factionFilter;
  if (s.stateFilter) stateFilter = s.stateFilter;
  if (s.sourceFilter) sourceFilter = s.sourceFilter;
  if (s.spearheadOnly) spearheadOnly = true;
  if (s.armySort) armySort = s.armySort;
  if (s.unitSort) unitSort = s.unitSort;
  if (s.quickView) quickView = s.quickView;
  if (s.tagFilter) tagFilter = s.tagFilter;
}

function persistFilterPrefs() {
  patchSettings({
    gameFilter,
    factionFilter,
    stateFilter,
    sourceFilter,
    spearheadOnly,
    armySort,
    unitSort,
    quickView,
    tagFilter,
  }, { silent: true });
}

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const noteTimers = new Map();

/** @type {ReturnType<typeof setTimeout>|undefined} */
let searchTimer;

export function clearArmyFilters() {
  gameFilter = 'All';
  factionFilter = 'All';
  searchTerm = '';
  stateFilter = 'All';
  sourceFilter = 'All';
  spearheadOnly = false;
  quickView = 'all';
  tagFilter = 'All';
  const el = document.getElementById('search');
  if (el instanceof HTMLInputElement) el.value = '';
  persistFilterPrefs();
}

function filtersActive() {
  return gameFilter !== 'All' || factionFilter !== 'All' || searchTerm || stateFilter !== 'All'
    || sourceFilter !== 'All' || spearheadOnly || quickView !== 'all' || tagFilter !== 'All';
}

/** @param {string} [notes] */
function extractTags(notes) {
  return (notes?.match(/#[\w-]+/g) || []).map(t => t.slice(1).toLowerCase());
}

function allNoteTags() {
  const tags = new Set();
  getState().collection.forEach(a => a.units.forEach(u => extractTags(u.notes).forEach(t => tags.add(t))));
  return [...tags].sort();
}

let eventsBound = false;

function collapsedSet() {
  return getCollapsedArmies();
}

function allUnits() {
  return getState().collection.flatMap(a => a.units);
}

function unitMatchesSearch(u, armyName, q) {
  if (!q) return true;
  const hay = `${u.unit} ${u.source} ${u.state} ${u.notes || ''} ${armyName}`.toLowerCase();
  return hay.includes(q);
}

function unitPassesQuickView(u, pipeline) {
  if (quickView === 'all') return true;
  if (quickView === 'backlog') return u.state === pipeline[0]?.key;
  if (quickView === 'wip') {
    return !DONE_STATES.includes(u.state) && u.state !== pipeline[0]?.key;
  }
  if (quickView === 'ready') return DONE_STATES.includes(u.state);
  return true;
}

function unitPassesFilters(u, pipeline) {
  if (stateFilter !== 'All' && u.state !== stateFilter) return false;
  if (sourceFilter !== 'All' && (u.source || '') !== sourceFilter) return false;
  if (spearheadOnly && !u.spearhead) return false;
  if (tagFilter !== 'All' && !extractTags(u.notes).includes(tagFilter)) return false;
  if (!unitPassesQuickView(u, pipeline)) return false;
  return true;
}

function sortUnits(units) {
  const copy = [...units];
  if (unitSort === 'state') {
    const pipeline = getPipeline();
    const idx = Object.fromEntries(pipeline.map((p, i) => [p.key, i]));
    copy.sort((a, b) => (idx[a.state] ?? 0) - (idx[b.state] ?? 0) || a.unit.localeCompare(b.unit));
  } else {
    copy.sort((a, b) => a.unit.localeCompare(b.unit));
  }
  return copy;
}

function sortArmies(armies) {
  const copy = [...armies];
  if (armySort === 'progress') {
    copy.sort((a, b) => collectionProgress(a.units, getArmyPipeline(a)) - collectionProgress(b.units, getArmyPipeline(b)));
  } else if (armySort === 'name') {
    copy.sort((a, b) => a.army.localeCompare(b.army));
  }
  return copy;
}

function visibleArmies() {
  const { collection } = getState();
  const q = searchTerm.toLowerCase();
  return sortArmies(collection
    .filter(a => (gameFilter === 'All' || a.game === gameFilter)
      && (factionFilter === 'All' || a.faction === factionFilter))
    .map(a => {
      const pipeline = getArmyPipeline(a);
      return {
        ...a,
        units: sortUnits(
          (q ? a.units.filter(u => unitMatchesSearch(u, a.army, q)) : a.units)
            .filter(u => unitPassesFilters(u, pipeline))
        ),
      };
    })
    .filter(a => !filtersActive() ? a.units.length >= 0 : a.units.length > 0));
}

function visibleUnits() {
  return visibleArmies().flatMap(a => a.units);
}

function nextStateKey(current, pipeline) {
  const i = pipeline.findIndex(p => p.key === current);
  if (i < 0 || i >= pipeline.length - 1) return null;
  return pipeline[i + 1].key;
}

export function renderArmyStats() {
  ensureFilterPrefs();
  const pipeline = getPipeline();
  const { collection } = getState();
  const scoped = filtersActive();
  const armies = visibleArmies();
  const units = scoped ? visibleUnits() : allUnits();
  const models = units.reduce((s, x) => s + modelCount(x), 0);
  const based = units.filter(x => x.state === 'Based').length;
  const done = units.filter(x => x.state === 'Done').length;
  const wip = units.filter(x => !DONE_STATES.includes(x.state) && x.state !== pipeline[0]?.key).length;
  const todo = units.filter(x => x.state === pipeline[0]?.key).length;
  const armyCount = scoped ? armies.length : collection.length;
  const scopeLabel = scoped ? ' (filtered)' : '';

  const tiles = [
    [units.length, `Unit Entries${scopeLabel}`, 0, 'Rows in your list (one row can represent multiple models).'],
    [models, `Models (est.)${scopeLabel}`, 1, 'Estimated from Qty and counts in parentheses, e.g. Clanrats (5) × Qty 2.'],
    [based, `Based${scopeLabel}`, 0, 'Units at Based stage (~87% progress).'],
    [done, `Done${scopeLabel}`, 0, 'Fully finished units (100% progress).'],
    [wip, 'In Progress', 0, ''],
    [todo, 'On the Sprue', 0, ''],
    [armyCount, `Armies${scopeLabel}`, 0, ''],
  ];

  document.getElementById('stats').innerHTML = tiles.map(t =>
    `<div class="tile ${t[2] ? 'accent' : ''}"${t[3] ? ` title="${escapeAttr(t[3])}"` : ''}><div class="v">${t[0]}</div><div class="l">${escapeHtml(t[1])}</div></div>`
  ).join('');

  const overall = collectionProgress(units, pipeline);
  const meterLabel = document.querySelector('.meter-top .lab');
  if (meterLabel) {
    meterLabel.textContent = scoped
      ? 'Filtered Progress (by model count)'
      : 'Collection Progress (by model count)';
  }
  document.getElementById('overallPct').textContent = `${Math.round(overall * 100)}%`;
  const segs = progressSegments(units, pipeline);
  document.getElementById('overallMeter').innerHTML = segs
    .map(s => `<span style="width:${s.pct}%;background:${safeColor(s.hex)}" title="${escapeAttr(s.key)}"></span>`)
    .join('');

  const legend = document.getElementById('meterLegend');
  if (legend) {
    legend.innerHTML = segs.map(s =>
      `<span class="legend-item"><span class="legend-swatch" style="background:${safeColor(s.hex)}"></span>${escapeHtml(s.key)}</span>`
    ).join('');
  }
}

export function renderArmyFilters(onChange) {
  ensureFilterPrefs();
  const { collection } = getState();
  const pipeline = getPipeline();
  const games = ['All', ...new Set(collection.map(a => a.game))];
  const facs = [...new Set(collection.map(a => a.faction))];
  const sources = ['All', ...new Set(collection.flatMap(a => a.units.map(u => u.source).filter(Boolean)))].sort();
  const states = ['All', ...pipeline.map(p => p.key)];
  const tags = allNoteTags();
  const views = [
    ['all', 'All'],
    ['backlog', 'Backlog'],
    ['wip', 'WIP'],
    ['ready', 'Table-ready'],
  ];
  const compact = facs.length > 8;

  const host = document.getElementById('filters');
  if (!host) return;
  const scrollTop = host.scrollTop;

  const gameBlock = compact
    ? `<label class="mini-label">Game <select id="gameFilter">${games.map(g =>
    `<option value="${escapeAttr(g)}"${gameFilter === g ? ' selected' : ''}>${escapeHtml(g)}</option>`
  ).join('')}</select></label>`
    : `<div class="filter-group"><span class="filter-label">Game</span>${games.map(f =>
    `<button class="chip ${gameFilter === f ? 'on' : ''}" data-g="${escapeAttr(f)}">${escapeHtml(f)}</button>`
  ).join('')}</div>`;

  const factionBlock = compact
    ? `<label class="mini-label">Faction <select id="factionFilter">${['All', ...facs].map(f =>
    `<option value="${escapeAttr(f)}"${factionFilter === f ? ' selected' : ''}>${escapeHtml(f)}</option>`
  ).join('')}</select></label>`
    : `<div class="filter-group"><span class="filter-label">Faction</span>${facs.map(f => {
    const fa = collection.find(a => a.faction === f);
    const userPresets = getState().settings.factionPresets;
    const color = fa
      ? getArmyPresentation(fa, userPresets).color
      : getArmyPresentation({ game: gameFilter !== 'All' ? gameFilter : '', faction: f, crest: '', color: '' }, userPresets).color;
    const dot = `<span class="dot" style="background:${safeColor(color)}"></span>`;
    return `<button class="chip ${factionFilter === f ? 'on' : ''}" data-f="${escapeAttr(f)}">${dot}${escapeHtml(f)}</button>`;
  }).join('')}</div>`;

  const tagBlock = tags.length
    ? `<div class="filter-group"><span class="filter-label">Tag</span>${['All', ...tags].map(t =>
    `<button class="chip ${tagFilter === t ? 'on' : ''}" data-tag="${escapeAttr(t)}">${escapeHtml(t === 'All' ? 'All' : `#${t}`)}</button>`
  ).join('')}</div>`
    : '';

  host.innerHTML = `
    ${compact ? `<div class="filter-row filter-compact">${gameBlock}${factionBlock}</div>` : `${gameBlock}${factionBlock}`}
    <div class="filter-group"><span class="filter-label">View</span>${views.map(([k, label]) =>
    `<button class="chip ${quickView === k ? 'on' : ''}" data-v="${escapeAttr(k)}">${escapeHtml(label)}</button>`
  ).join('')}</div>
    ${tagBlock}
    <div class="filter-row">
      ${compact ? '' : ''}
      <label class="mini-label">State <select id="stateFilter">${states.map(s =>
    `<option value="${escapeAttr(s)}"${stateFilter === s ? ' selected' : ''}>${escapeHtml(s)}</option>`
  ).join('')}</select></label>
      <label class="mini-label">Source <select id="sourceFilter">${sources.map(s =>
    `<option value="${escapeAttr(s)}"${sourceFilter === s ? ' selected' : ''}>${escapeHtml(s)}</option>`
  ).join('')}</select></label>
      <label class="mini-label chk"><input type="checkbox" id="spearFilter" ${spearheadOnly ? 'checked' : ''}> Spearhead only</label>
      <label class="mini-label">Sort armies <select id="armySort">
        <option value="csv"${armySort === 'csv' ? ' selected' : ''}>Import order</option>
        <option value="name"${armySort === 'name' ? ' selected' : ''}>Name</option>
        <option value="progress"${armySort === 'progress' ? ' selected' : ''}>Least complete</option>
      </select></label>
      <label class="mini-label">Sort units <select id="unitSort">
        <option value="name"${unitSort === 'name' ? ' selected' : ''}>Name</option>
        <option value="state"${unitSort === 'state' ? ' selected' : ''}>State</option>
      </select></label>
    </div>`;

  host.querySelectorAll('.chip[data-g]').forEach(c => {
    c.onclick = () => {
      gameFilter = c.dataset.g || 'All';
      persistFilterPrefs();
      onChange();
    };
  });
  host.querySelectorAll('.chip[data-f]').forEach(c => {
    c.onclick = () => {
      factionFilter = c.dataset.f || 'All';
      persistFilterPrefs();
      onChange();
    };
  });
  host.querySelectorAll('.chip[data-tag]').forEach(c => {
    c.onclick = () => {
      tagFilter = c.dataset.tag || 'All';
      persistFilterPrefs();
      onChange();
    };
  });
  document.getElementById('gameFilter')?.addEventListener('change', e => {
    gameFilter = /** @type {HTMLSelectElement} */ (e.target).value;
    persistFilterPrefs();
    onChange();
  });
  document.getElementById('factionFilter')?.addEventListener('change', e => {
    factionFilter = /** @type {HTMLSelectElement} */ (e.target).value;
    persistFilterPrefs();
    onChange();
  });
  host.querySelectorAll('.chip[data-v]').forEach(c => {
    c.onclick = () => {
      quickView = c.dataset.v || 'all';
      persistFilterPrefs();
      onChange();
    };
  });
  document.getElementById('stateFilter')?.addEventListener('change', e => {
    stateFilter = /** @type {HTMLSelectElement} */ (e.target).value;
    persistFilterPrefs();
    onChange();
  });
  document.getElementById('sourceFilter')?.addEventListener('change', e => {
    sourceFilter = /** @type {HTMLSelectElement} */ (e.target).value;
    persistFilterPrefs();
    onChange();
  });
  document.getElementById('spearFilter')?.addEventListener('change', e => {
    spearheadOnly = /** @type {HTMLInputElement} */ (e.target).checked;
    persistFilterPrefs();
    onChange();
  });
  document.getElementById('armySort')?.addEventListener('change', e => {
    armySort = /** @type {HTMLSelectElement} */ (e.target).value;
    persistFilterPrefs();
    onChange();
  });
  document.getElementById('unitSort')?.addEventListener('change', e => {
    unitSort = /** @type {HTMLSelectElement} */ (e.target).value;
    persistFilterPrefs();
    onChange();
  });
  host.scrollTop = scrollTop;
}

function unitRow(army, unit, index, pipeline, stateHex) {
  const showSpear = army.units.some(u => u.spearhead !== undefined);
  const hex = stateHex[unit.state] || '#888';
  const arrow = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='${encodeURIComponent(hex)}' stroke-width='1.6' fill='none'/%3E%3C/svg%3E`;
  const opts = pipeline.map(p =>
    `<option ${p.key === unit.state ? 'selected' : ''}>${escapeHtml(p.key)}</option>`
  ).join('');
  const next = nextStateKey(unit.state, pipeline);
  const nextBtn = next
    ? `<button class="next-st" type="button" data-act="next" title="Advance to ${escapeAttr(next)}">→</button>`
    : '';
  const spearCell = showSpear
    ? `<button type="button" class="spear-btn" data-act="spear" title="Toggle spearhead">${unit.spearhead ? '<span class="spear">★</span>' : '<span class="spear-no">·</span>'}</button>`
    : '<span class="spear-no">—</span>';
  const noteTitle = (unit.notes || '').length > 48 ? escapeAttr(unit.notes) : '';

  return `<tr data-army="${escapeAttr(army.army)}" data-i="${index}">
    <td class="unit"><input class="inline-in unit-name-in" value="${escapeAttr(unit.unit)}" data-act="unit" aria-label="Unit name">
      <input class="inline-in src-in" value="${escapeAttr(unit.source || '')}" data-act="source" placeholder="source" aria-label="Source"></td>
    <td class="qty"><input class="inline-in qty-in" type="number" min="1" value="${unit.qty || 1}" data-act="qty" aria-label="Quantity"></td>
    <td class="c state-cell"><select class="state-sel" aria-label="Painting state" style="color:${safeColor(hex)};border-color:${safeColor(hex)}66;background-color:${safeColor(hex)}1a;background-image:url(&quot;${arrow}&quot;)" data-act="state">${opts}</select>${nextBtn}</td>
    <td class="c">${spearCell}</td>
    <td><textarea class="note-in" rows="1" data-act="note" placeholder="add note…" aria-label="Notes"${noteTitle ? ` title="${noteTitle}"` : ''}>${escapeHtml(unit.notes || '')}</textarea></td>
    <td class="row-actions">
      <button class="dup" type="button" data-act="dup" title="Duplicate row">⧉</button>
      <button class="mov" type="button" data-act="move" title="Move to another army">⇄</button>
      <button class="del" type="button" title="Remove" data-act="del">✕</button>
    </td>
  </tr>`;
}

function armyBlock(army, pipeline) {
  const prog = Math.round(collectionProgress(army.units, pipeline) * 100);
  const seg = progressSegments(army.units, pipeline);
  const anySpear = army.units.some(u => u.spearhead !== undefined);
  const stateHex = buildStateHexMap(pipeline);
  const isCollapsed = collapsedSet().has(army.army);
  const collapsed = isCollapsed ? ' collapsed' : '';
  const { crest, color } = getArmyPresentation(army, getState().settings.factionPresets);
  const unitRows = isCollapsed
    ? `<tr data-lazy-units="1"><td colspan="6" class="army-lazy-msg">${army.units.length} unit entries — expand to view</td></tr>`
    : army.units.map((u, i) => unitRow(army, u, i, pipeline, stateHex)).join('');

  const pipeHint = army.pipeline?.length ? ' · custom pipeline' : '';
  return `<div class="army${collapsed}" style="--fac:${safeColor(color)}" data-army="${escapeAttr(army.army)}">
    <div class="army-head" data-act="toggle">
      <div class="crest">${escapeHtml(crest)}</div>
      <div class="meta"><div class="nm">${escapeHtml(army.army)}</div><div class="gm">${escapeHtml(army.game)} · ${escapeHtml(army.faction)} · ${army.units.length} entries${pipeHint}</div></div>
      <div class="prog"><div class="p">${prog}%</div><div class="c">complete</div></div>
      <div class="army-actions" data-stop>
        <button type="button" class="btn sm" data-act="army-pipeline" title="Army pipeline">⚙</button>
        <button type="button" class="btn sm" data-act="army-theme" title="Reset crest & colour to faction defaults">◐</button>
        <button type="button" class="btn sm" data-act="army-rename" title="Rename army">✎</button>
        <button type="button" class="btn sm" data-act="army-del" title="Delete army">✕</button>
      </div>
      <div class="chev">▾</div>
    </div>
    <div class="army-bar">${seg.map(s => `<span style="width:${s.pct}%;background:${safeColor(s.hex)}" title="${escapeAttr(s.key)}"></span>`).join('')}</div>
    <div class="army-body"><table><thead><tr>
      <th>Unit</th><th class="c">Qty</th><th class="c">State</th><th class="c">${anySpear ? 'Spearhead' : ''}</th><th>Notes</th><th></th>
    </tr></thead><tbody>
      ${unitRows}
      <tr><td colspan="6" class="army-foot">
        <button class="add-btn" data-act="add">+ Add unit</button>
        <button class="add-btn" data-act="bulk-next">→ Advance all in army</button>
        <button class="add-btn" data-act="merge-dups" title="Combine rows with same unit, source, and state">⧉ Merge duplicates</button>
      </td></tr>
    </tbody></table></div>
  </div>`;
}

function findUnit(armyName, index) {
  const a = getState().collection.find(x => x.army === armyName);
  return { a, u: a?.units[index], realIndex: index };
}

/** @param {() => void} onChange */
function bindArmyEvents(onChange) {
  if (eventsBound) return;
  eventsBound = true;

  const host = document.getElementById('armies');
  if (!host) return;

  host.addEventListener('click', async e => {
    const target = /** @type {HTMLElement} */ (e.target);
    if (target.closest('[data-stop]')) e.stopPropagation();

    const actEl = target.closest('[data-act]');
    if (!actEl) return;
    const act = actEl.getAttribute('data-act');

    if (act === 'toggle' && !target.closest('[data-stop]')) {
      const armyEl = actEl.closest('.army');
      const name = armyEl?.dataset.army;
      const wasCollapsed = armyEl?.classList.contains('collapsed');
      armyEl?.classList.toggle('collapsed');
      if (name) {
        const c = collapsedSet();
        if (armyEl?.classList.contains('collapsed')) c.add(name);
        else c.delete(name);
        setCollapsedArmies(c);
      }
      if (wasCollapsed && armyEl?.querySelector('[data-lazy-units]')) onChange();
      return;
    }

    const tr = actEl.closest('tr[data-army]');
    const armyEl = actEl.closest('.army');
    const armyName = tr?.dataset.army || armyEl?.dataset.army;
    const index = +(tr?.dataset.i ?? -1);

    if (act === 'army-pipeline' && armyName) {
      await openArmyPipelineSettings(armyName);
      onChange();
      return;
    }

    if (act === 'army-theme' && armyName) {
      if (reapplyArmyFactionDefaults(armyName)) {
        onChange();
        toast('Faction crest & colour reset');
      }
      return;
    }

    if (act === 'army-rename' && armyName) {
      const data = await formDialog('Rename army', [
        { id: 'name', label: 'Army name', value: armyName },
      ]);
      if (data?.name && data.name !== armyName) {
        renameArmy(armyName, data.name.trim());
        onChange();
      }
      return;
    }

    if (act === 'army-del' && armyName) {
      if (await confirmDialog(`Delete entire army "${armyName}" and all its units?`, { okLabel: 'Delete', danger: true })) {
        removeArmy(armyName);
        onChange();
        toast('Army deleted — Ctrl+Z to undo', 2500);
      }
      return;
    }

    if (act === 'del' && armyName != null && tr) {
      const { u } = findUnit(armyName, index);
      if (u && await confirmDialog(`Remove "${u.unit}" from ${armyName}?`, { okLabel: 'Remove', danger: true })) {
        removeUnit(armyName, index);
        onChange();
        toast('Removed — Ctrl+Z to undo', 2500);
      }
      return;
    }

    if (act === 'dup' && armyName != null) {
      duplicateUnit(armyName, index);
      onChange();
      return;
    }

    if (act === 'spear' && armyName != null) {
      const { u } = findUnit(armyName, index);
      if (u) {
        updateUnit(armyName, index, { spearhead: !u.spearhead }, { silent: true });
        onChange();
      }
      return;
    }

    if (act === 'next' && armyName != null && tr) {
      const army = getState().collection.find(a => a.army === armyName);
      const { u } = findUnit(armyName, index);
      const pipeline = getArmyPipeline(army);
      const next = u ? nextStateKey(u.state, pipeline) : null;
      if (next) {
        updateUnit(armyName, index, { state: next });
        onChange();
      }
      return;
    }

    if (act === 'bulk-next' && armyName) {
      const army = getState().collection.find(a => a.army === armyName);
      if (!army) return;
      const pipeline = getArmyPipeline(army);
      /** @type {{ armyName: string, index: number, state: string }[]} */
      const changes = [];
      army.units.forEach((u, i) => {
        const next = nextStateKey(u.state, pipeline);
        if (next) changes.push({ armyName, index: i, state: u.state });
      });
      pushUndoBatchStates(changes);
      beginBatch({ silent: true });
      army.units.forEach((u, i) => {
        const next = nextStateKey(u.state, pipeline);
        if (next) updateUnit(armyName, i, { state: next }, { silent: true, skipUndo: true });
      });
      endBatch('collection');
      onChange();
      return;
    }

    if (act === 'merge-dups' && armyName) {
      const removed = mergeArmyDuplicates(armyName);
      if (removed > 0) {
        onChange();
        toast(`Merged ${removed} duplicate row(s)`);
      } else {
        toast('No duplicate rows to merge');
      }
      return;
    }

    if (act === 'move' && armyName != null && tr) {
      const { u } = findUnit(armyName, index);
      if (!u) return;
      const armies = getState().collection.map(a => a.army).filter(n => n !== armyName);
      if (!armies.length) {
        toast('No other armies to move to');
        return;
      }
      const data = await formDialog(`Move "${u.unit}" to…`, [
        { id: 'dest', label: 'Destination army', options: armies, value: armies[0] },
      ]);
      if (data?.dest && moveUnit(armyName, index, data.dest)) {
        onChange();
        toast(`Moved to ${data.dest}`);
      }
      return;
    }

    if (act === 'add' && armyName) {
      const army = getState().collection.find(x => x.army === armyName);
      const pipeline = getArmyPipeline(army);
      const data = await formDialog('Add unit', [
        { id: 'unit', label: 'Unit name', value: '' },
        { id: 'qty', label: 'Qty', type: 'number', value: '1', min: 1 },
        { id: 'source', label: 'Source', value: '' },
        { id: 'state', label: 'State', options: pipeline.map(p => p.key), value: pipeline[0]?.key },
      ]);
      if (!data?.unit?.trim()) return;
      const nu = {
        unit: data.unit.trim(),
        qty: Math.max(1, +(data.qty || 1)),
        source: data.source || '',
        state: data.state || pipeline[0]?.key || 'Unassembled',
        notes: '',
      };
      if (army?.units.some(x => x.spearhead !== undefined)) nu.spearhead = false;
      addUnit(armyName, nu);
      onChange();
    }
  });

  host.addEventListener('change', e => {
    const target = /** @type {HTMLElement} */ (e.target);
    const act = target.getAttribute('data-act');
    const tr = target.closest('tr[data-army]');
    if (!tr || !act) return;

    const armyName = tr.dataset.army || '';
    const index = +tr.dataset.i;

    if (act === 'state' && target instanceof HTMLSelectElement) {
      updateUnit(armyName, index, { state: target.value });
      onChange();
    }
    if (act === 'qty' && target instanceof HTMLInputElement) {
      const q = Math.max(1, +target.value || 1);
      target.value = String(q);
      updateUnit(armyName, index, { qty: q }, { silent: true });
      renderArmyStats();
    }
  });

  host.addEventListener('blur', e => {
    const target = /** @type {HTMLElement} */ (e.target);
    const act = target.getAttribute('data-act');
    const tr = target.closest('tr[data-army]');
    if (!tr || !act) return;
    const armyName = tr.dataset.army || '';
    const index = +tr.dataset.i;
    if (!(target instanceof HTMLInputElement)) return;
    if (act === 'unit') updateUnit(armyName, index, { unit: target.value.trim() }, { silent: true });
    if (act === 'source') updateUnit(armyName, index, { source: target.value.trim() }, { silent: true });
  }, true);

  host.addEventListener('input', e => {
    const target = /** @type {HTMLElement} */ (e.target);
    if (target.getAttribute('data-act') === 'note' && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      const tr = target.closest('tr[data-army]');
      if (!tr) return;
      const armyName = tr.dataset.army || '';
      const index = +tr.dataset.i;
      const key = `${armyName}:${index}`;
      clearTimeout(noteTimers.get(key));
      noteTimers.set(key, setTimeout(() => {
        updateUnit(armyName, index, { notes: target.value }, { silent: true });
        noteTimers.delete(key);
      }, 300));
    }
  });
}

export function renderArmies(onChange) {
  const host = document.getElementById('armies');
  const { collection } = getState();

  if (!collection.length) {
    host.innerHTML = `<div class="empty-state" id="armiesDrop">
      <h2>No armies yet</h2>
      <p>Import <code>warhammer_armies.csv</code>, download the template, or load the sample collection. Then switch to the <strong>Paint Rack</strong> tab for paints.</p>
      <div class="empty-actions">
        <button class="btn gold" id="emptyImportArmies">⬆ Import Armies CSV</button>
        <button class="btn" id="emptyTemplateArmies">📄 Download template</button>
        <button class="btn" id="emptyNewArmy">+ New army</button>
      </div>
      <div class="drop-zone">Drop armies CSV here</div>
    </div>`;
    document.getElementById('emptyImportArmies')?.addEventListener('click', () => {
      document.getElementById('fileInputArmies')?.click();
    });
    document.getElementById('emptyTemplateArmies')?.addEventListener('click', () => {
      downloadTemplate('armies');
      toast('Template downloaded');
    });
    document.getElementById('emptyNewArmy')?.addEventListener('click', () => createArmyFlow(onChange));
    wireDropZone(document.getElementById('armiesDrop'), 'armies');
    return;
  }

  const visible = visibleArmies();

  if (!visible.length && filtersActive()) {
    host.innerHTML = `<div class="empty-state filtered-empty">
      <h2>No matching units</h2>
      <p>Nothing matches your current search or filters.</p>
      <button class="btn gold" type="button" id="clearArmyFilters">Clear filters</button>
    </div>`;
    document.getElementById('clearArmyFilters')?.addEventListener('click', () => {
      clearArmyFilters();
      onChange();
    });
    bindArmyEvents(onChange);
    return;
  }

  host.innerHTML = `<div class="army-toolbar"><button class="btn" type="button" id="newArmyBtn">+ New army</button>
    <button class="btn" type="button" id="undoBtn" title="Undo (Ctrl+Z)">↩ Undo</button></div>`
    + visible.map(va => {
      const army = getState().collection.find(x => x.army === va.army);
      if (!army) return '';
      return armyBlock({ ...army, units: va.units }, getArmyPipeline(army));
    }).join('');
  document.getElementById('newArmyBtn')?.addEventListener('click', () => createArmyFlow(onChange));
  document.getElementById('undoBtn')?.addEventListener('click', () => {
    if (undoLast()) { onChange(); toast('Undone'); }
    else toast('Nothing to undo');
  });
  bindArmyEvents(onChange);
}

async function createArmyFlow(onChange) {
  const data = await formDialog('New army', [
    { id: 'game', label: 'Game', options: SUPPORTED_GAMES, value: '40k' },
    { id: 'faction', label: 'Faction', optgroups: CANONICAL_FACTIONS, value: '' },
    { id: 'army', label: 'Army name', value: '' },
  ]);
  if (!data?.army?.trim()) return;
  const game = data.game?.trim() || '40k';
  const faction = data.faction?.trim() || 'Custom';
  const userPresets = getState().settings.factionPresets;
  const draft = { game, faction, army: data.army.trim(), crest: '', color: '', units: [] };
  const { crest, color } = getArmyPresentation(draft, userPresets);
  addArmy({
    ...draft,
    army: data.army.trim(),
    crest,
    color,
  });
  onChange();
}

/** @type {(() => void)|null} */
let domainRefresh = null;

export function setArmyDomainRefresh(fn) {
  domainRefresh = fn;
}

export function bindArmySearch() {
  document.getElementById('search')?.addEventListener('input', e => {
    searchTerm = /** @type {HTMLInputElement} */ (e.target).value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => domainRefresh?.(), 200);
  });
}

export function bindArmyExpandCollapse() {
  document.getElementById('expandAll')?.addEventListener('click', () => {
    setCollapsedArmies(new Set());
    domainRefresh?.();
  });
  document.getElementById('collapseAll')?.addEventListener('click', () => {
    const all = new Set(getState().collection.map(a => a.army));
    setCollapsedArmies(all);
    domainRefresh?.();
  });
}

/** Advance every visible unit one pipeline step. */
export function advanceVisibleUnits() {
  /** @type {{ armyName: string, index: number, state: string }[]} */
  const changes = [];
  visibleArmies().forEach(va => {
    const army = getState().collection.find(a => a.army === va.army);
    if (!army) return;
    const pipeline = getArmyPipeline(army);
    va.units.forEach(vu => {
      const i = army.units.indexOf(vu);
      if (i < 0) return;
      const next = nextStateKey(vu.state, pipeline);
      if (next) changes.push({ armyName: va.army, index: i, state: vu.state });
    });
  });
  if (!changes.length) return;
  pushUndoBatchStates(changes);
  beginBatch({ silent: true });
  changes.forEach(({ armyName, index, state: _prev }) => {
    const army = getState().collection.find(a => a.army === armyName);
    if (!army) return;
    const pipeline = getArmyPipeline(army);
    const u = army.units[index];
    const next = u ? nextStateKey(u.state, pipeline) : null;
    if (next) updateUnit(armyName, index, { state: next }, { silent: true, skipUndo: true });
  });
  endBatch('collection');
  domainRefresh?.();
}

/** @param {string} source — filter armies tab by paint kit source (fuzzy match on select). */
export function applySourceFilterFromPaint(source) {
  ensureFilterPrefs();
  const { collection } = getState();
  const parts = source.split('+').map(s => s.trim()).filter(Boolean);
  const match = collection.flatMap(a => a.units.map(u => u.source || '')).find(us =>
    parts.some(p => us.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(us.toLowerCase()))
  );
  sourceFilter = match || parts[0] || source;
  quickView = 'all';
  gameFilter = 'All';
  factionFilter = 'All';
  persistFilterPrefs();
  domainRefresh?.();
}
