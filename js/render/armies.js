import { getState, getPipeline, updateUnit, removeUnit, addUnit } from '../core/store.js';
import {
  modelCount,
  stateProgress,
  progressSegments,
  buildStateHexMap,
} from '../core/pipeline.js';
import { DONE_STATES } from '../core/constants.js';
import { escapeHtml, escapeAttr, safeColor } from '../core/dom.js';
import { wireDropZone } from '../ui/dropzone.js';
import { downloadTemplate } from '../data/export.js';
import { toast } from '../ui/toast.js';

/** @type {string} */
let activeFilter = 'All';
/** @type {string} */
let searchTerm = '';
/** @type {Set<string>} */
const collapsedArmies = new Set();

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const noteTimers = new Map();

let eventsBound = false;

function allUnits() {
  return getState().collection.flatMap(a => a.units);
}

function armyProgress(army, pipeline) {
  if (!army.units.length) return 0;
  return army.units.reduce((s, u) => s + stateProgress(u.state, pipeline), 0) / army.units.length;
}

export function renderArmyStats() {
  const pipeline = getPipeline();
  const { collection } = getState();
  const units = allUnits();
  const models = units.reduce((s, x) => s + modelCount(x), 0);
  const done = units.filter(x => DONE_STATES.includes(x.state)).length;
  const wip = units.filter(x => !DONE_STATES.includes(x.state) && x.state !== pipeline[0]?.key).length;
  const todo = units.filter(x => x.state === pipeline[0]?.key).length;

  const tiles = [
    [units.length, 'Unit Entries'],
    [models, 'Models (est.)', 1],
    [done, 'Based / Done'],
    [wip, 'In Progress'],
    [todo, 'On the Sprue'],
    [collection.length, 'Armies'],
  ];

  document.getElementById('stats').innerHTML = tiles.map(t =>
    `<div class="tile ${t[2] ? 'accent' : ''}"><div class="v">${t[0]}</div><div class="l">${escapeHtml(t[1])}</div></div>`
  ).join('');

  const overall = units.length
    ? units.reduce((s, x) => s + stateProgress(x.state, pipeline), 0) / units.length
    : 0;
  document.getElementById('overallPct').textContent = `${Math.round(overall * 100)}%`;
  document.getElementById('overallMeter').innerHTML = progressSegments(units, pipeline)
    .map(s => `<span style="width:${s.pct}%;background:${safeColor(s.hex)}"></span>`)
    .join('');
}

export function renderArmyFilters(onChange) {
  const { collection } = getState();
  const games = ['All', ...new Set(collection.map(a => a.game))];
  const facs = [...new Set(collection.map(a => a.faction))];

  document.getElementById('filters').innerHTML = [...games, ...facs].map(f => {
    const fa = collection.find(a => a.faction === f);
    const dot = fa ? `<span class="dot" style="background:${safeColor(fa.color)}"></span>` : '';
    return `<button class="chip ${activeFilter === f ? 'on' : ''}" data-f="${escapeAttr(f)}">${dot}${escapeHtml(f)}</button>`;
  }).join('');

  document.querySelectorAll('#filters .chip').forEach(c => {
    c.onclick = () => { activeFilter = c.dataset.f || 'All'; onChange(); };
  });
}

function unitRow(army, unit, index, pipeline, stateHex) {
  const showSpear = unit.spearhead !== undefined;
  const hex = stateHex[unit.state] || '#888';
  const arrow = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='${encodeURIComponent(hex)}' stroke-width='1.6' fill='none'/%3E%3C/svg%3E`;
  const opts = pipeline.map(p =>
    `<option ${p.key === unit.state ? 'selected' : ''}>${escapeHtml(p.key)}</option>`
  ).join('');

  return `<tr data-army="${escapeAttr(army.army)}" data-i="${index}">
    <td class="unit">${escapeHtml(unit.unit)}<span class="src">${escapeHtml(unit.source || '')}</span></td>
    <td class="qty">${modelCount(unit)}</td>
    <td class="c"><select class="state-sel" style="color:${safeColor(hex)};border-color:${safeColor(hex)}66;background-color:${safeColor(hex)}1a;background-image:url(&quot;${arrow}&quot;)" data-act="state">${opts}</select></td>
    <td class="c">${showSpear ? (unit.spearhead ? '<span class="spear">★</span>' : '<span class="spear-no">·</span>') : '<span class="spear-no">—</span>'}</td>
    <td><input class="note-in" value="${escapeAttr(unit.notes || '')}" data-act="note" placeholder="add note…"></td>
    <td class="row-actions"><button class="del" title="Remove" data-act="del">✕</button></td>
  </tr>`;
}

function armyBlock(army, pipeline) {
  const prog = Math.round(armyProgress(army, pipeline) * 100);
  const seg = progressSegments(army.units, pipeline);
  const anySpear = army.units.some(u => u.spearhead !== undefined);
  const stateHex = buildStateHexMap(pipeline);
  const collapsed = collapsedArmies.has(army.army) ? ' collapsed' : '';

  return `<div class="army${collapsed}" style="--fac:${safeColor(army.color)}" data-army="${escapeAttr(army.army)}">
    <div class="army-head" data-act="toggle">
      <div class="crest">${escapeHtml(army.crest)}</div>
      <div class="meta"><div class="nm">${escapeHtml(army.army)}</div><div class="gm">${escapeHtml(army.game)} · ${escapeHtml(army.faction)} · ${army.units.length} entries</div></div>
      <div class="prog"><div class="p">${prog}%</div><div class="c">complete</div></div>
      <div class="chev">▾</div>
    </div>
    <div class="army-bar">${seg.map(s => `<span style="width:${s.pct}%;background:${safeColor(s.hex)}"></span>`).join('')}</div>
    <div class="army-body"><table><thead><tr>
      <th>Unit</th><th class="c">Models</th><th class="c">State</th><th class="c">${anySpear ? 'Spearhead' : ''}</th><th>Notes</th><th></th>
    </tr></thead><tbody>
      ${army.units.map((u, i) => unitRow(army, u, i, pipeline, stateHex)).join('')}
      <tr><td colspan="6"><button class="add-btn" data-act="add">+ Add unit to ${escapeHtml(army.army)}</button></td></tr>
    </tbody></table></div>
  </div>`;
}

function findUnit(armyName, index) {
  const a = getState().collection.find(x => x.army === armyName);
  return { a, u: a?.units[index] };
}

function applySearch() {
  const q = searchTerm.toLowerCase();
  document.querySelectorAll('tr[data-army]').forEach(tr => {
    const { u } = findUnit(tr.dataset.army || '', +tr.dataset.i);
    if (!u) return;
    const hay = `${u.unit} ${u.source} ${u.state} ${u.notes || ''} ${tr.dataset.army}`.toLowerCase();
    tr.style.display = !q || hay.includes(q) ? '' : 'none';
  });
}

/** @param {() => void} onChange */
function bindArmyEvents(onChange) {
  if (eventsBound) return;
  eventsBound = true;

  const host = document.getElementById('armies');
  if (!host) return;

  host.addEventListener('click', e => {
    const target = /** @type {HTMLElement} */ (e.target);
    const actEl = target.closest('[data-act]');
    if (!actEl) return;
    const act = actEl.getAttribute('data-act');

    if (act === 'toggle') {
      const armyEl = actEl.closest('.army');
      const name = armyEl?.dataset.army;
      armyEl?.classList.toggle('collapsed');
      if (name) {
        if (armyEl?.classList.contains('collapsed')) collapsedArmies.add(name);
        else collapsedArmies.delete(name);
      }
      return;
    }

    const tr = actEl.closest('tr[data-army]');
    const armyName = tr?.dataset.army;
    const index = +(tr?.dataset.i || -1);

    if (act === 'del' && armyName != null && tr) {
      const { u } = findUnit(armyName, index);
      if (u && confirm(`Remove "${u.unit}" from ${armyName}?`)) {
        removeUnit(armyName, index);
        onChange();
      }
      return;
    }

    if (act === 'add') {
      const armyEl = actEl.closest('.army');
      const name = armyEl?.dataset.army;
      if (!name) return;
      const n = prompt("Unit name? (e.g. 'Clanrats (5)')");
      if (!n) return;
      const army = getState().collection.find(x => x.army === name);
      const nu = { unit: n, qty: 1, source: '', state: getPipeline()[0]?.key || 'Unassembled', notes: '' };
      if (army?.units.some(x => x.spearhead !== undefined)) nu.spearhead = false;
      addUnit(name, nu);
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
  });

  host.addEventListener('input', e => {
    const target = /** @type {HTMLElement} */ (e.target);
    if (target.getAttribute('data-act') !== 'note' || !(target instanceof HTMLInputElement)) return;
    const tr = target.closest('tr[data-army]');
    if (!tr) return;

    const armyName = tr.dataset.army || '';
    const index = +tr.dataset.i;
    const key = `${armyName}:${index}`;
    clearTimeout(noteTimers.get(key));
    noteTimers.set(key, setTimeout(() => {
      updateUnit(armyName, index, { notes: target.value });
      noteTimers.delete(key);
    }, 300));
  });
}

export function renderArmies(onChange) {
  const host = document.getElementById('armies');
  const { collection } = getState();

  if (!collection.length) {
    host.innerHTML = `<div class="empty-state" id="armiesDrop">
      <h2>No armies yet</h2>
      <p>Import a <code>warhammer_armies.csv</code> or download the template and fill in your collection.</p>
      <div class="empty-actions">
        <button class="btn gold" id="emptyImportArmies">⬆ Import Armies CSV</button>
        <button class="btn" id="emptyTemplateArmies">📄 Download template</button>
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
    wireDropZone(document.getElementById('armiesDrop'), 'armies');
    return;
  }

  const pipeline = getPipeline();
  const visible = collection.filter(a =>
    activeFilter === 'All' || a.game === activeFilter || a.faction === activeFilter
  );
  host.innerHTML = visible.map(a => armyBlock(a, pipeline)).join('');
  applySearch();
  bindArmyEvents(onChange);
}

export function bindArmySearch() {
  document.getElementById('search')?.addEventListener('input', e => {
    searchTerm = /** @type {HTMLInputElement} */ (e.target).value;
    applySearch();
  });
}

export function bindArmyExpandCollapse() {
  document.getElementById('expandAll')?.addEventListener('click', () => {
    collapsedArmies.clear();
    document.querySelectorAll('.army').forEach(a => a.classList.remove('collapsed'));
  });
  document.getElementById('collapseAll')?.addEventListener('click', () => {
    document.querySelectorAll('.army').forEach(a => {
      const name = a.dataset.army;
      if (name) collapsedArmies.add(name);
      a.classList.add('collapsed');
    });
  });
}
