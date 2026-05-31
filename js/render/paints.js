import { getState, addPaint, updatePaint, removePaint } from '../core/store.js';
import { DEFAULT_PAINT_TYPES } from '../core/constants.js';
import { escapeHtml, escapeAttr, safeColor } from '../core/dom.js';
import { wireDropZone } from '../ui/dropzone.js';
import { downloadTemplate } from '../data/export.js';
import { toast } from '../ui/toast.js';
import { confirmDialog } from '../ui/confirm.js';
import { formDialog } from '../ui/form-modal.js';

/** @type {string} */
let paintFilter = 'All';
/** @type {string} */
let brandFilter = 'All';
/** @type {string} */
let paintSearch = '';

/** @type {ReturnType<typeof setTimeout>|undefined} */
let paintSearchTimer;

/** @param {string} source */
function sourceParts(source) {
  if (!source) return [];
  return source.split('+').map(s => s.trim().toLowerCase()).filter(Boolean);
}

/** @param {string} paintSource @param {string} unitSource */
function sourcesMatch(paintSource, unitSource) {
  const us = unitSource.toLowerCase();
  if (!us) return false;
  return sourceParts(paintSource).some(p => us.includes(p) || p.includes(us));
}

/** @param {string} source */
function unitsForSource(source) {
  if (!source) return 0;
  return getState().collection.reduce((n, a) =>
    n + a.units.filter(u => sourcesMatch(source, u.source || '')).length, 0);
}

export function clearPaintFilters() {
  paintFilter = 'All';
  brandFilter = 'All';
  paintSearch = '';
  lowOnly = false;
  const el = document.getElementById('paintSearch');
  if (el instanceof HTMLInputElement) el.value = '';
}

/** @type {boolean} */
let lowOnly = false;

function paintFiltersActive() {
  return paintFilter !== 'All' || brandFilter !== 'All' || paintSearch || lowOnly;
}

function filteredPaints() {
  const { paints } = getState();
  const q = paintSearch.toLowerCase();
  return paints.filter(p =>
    (!lowOnly || p.low) &&
    (paintFilter === 'All' || p.type === paintFilter) &&
    (brandFilter === 'All' || p.brand === brandFilter) &&
    (!q || `${p.name} ${p.type} ${p.brand || ''} ${p.source || ''} ${p.notes || ''}`.toLowerCase().includes(q))
  );
}

const PAINT_TYPES = ['', 'Base', 'Shade', 'Technical', 'Speedpaint', 'Speedpaint Metallic', 'Medium', 'Primer', 'Basing'];

async function paintForm(existing) {
  const types = [...new Set([...PAINT_TYPES, ...getState().paints.map(p => p.type).filter(Boolean)])];
  return formDialog(existing ? 'Edit paint' : 'Add paint', [
    { id: 'name', label: 'Name', value: existing?.name || '' },
    { id: 'type', label: 'Type', options: types.length ? types : PAINT_TYPES, value: existing?.type || '' },
    { id: 'brand', label: 'Brand', value: existing?.brand || '' },
    { id: 'source', label: 'Source', value: existing?.source || '' },
    { id: 'qty', label: 'Quantity', type: 'number', value: String(existing?.qty || 1), min: 1 },
    { id: 'low', label: 'Running low / need more', options: ['No', 'Yes'], value: existing?.low ? 'Yes' : 'No' },
    { id: 'notes', label: 'Notes', value: existing?.notes || '' },
  ]);
}

async function addPaintFlow() {
  const data = await paintForm(null);
  if (!data?.name?.trim()) return;
  const type = data.type?.trim() || '';
  const ok = addPaint({
    name: data.name.trim(),
    type,
    swatch: DEFAULT_PAINT_TYPES[type] || '#777',
    qty: Math.max(1, +(data.qty || 1)),
    brand: data.brand?.trim() || '',
    source: data.source?.trim() || '',
    notes: data.notes?.trim() || '',
    ...(data.low === 'Yes' ? { low: true } : {}),
  });
  if (ok) {
    renderPaints();
    toast('Paint added');
  } else {
    toast('A paint with that name already exists');
  }
}

async function editPaintFlow(name) {
  const existing = getState().paints.find(p => p.name === name);
  if (!existing) return;
  const data = await paintForm(existing);
  if (!data?.name?.trim()) return;
  const type = data.type?.trim() || '';
  const patch = {
    name: data.name.trim(),
    type,
    swatch: DEFAULT_PAINT_TYPES[type] || existing.swatch || '#777',
    qty: Math.max(1, +(data.qty || 1)),
    brand: data.brand?.trim() || '',
    source: data.source?.trim() || '',
    notes: data.notes?.trim() || '',
    low: data.low === 'Yes',
  };
  if (updatePaint(name, patch)) {
    renderPaints();
    toast('Paint updated');
  } else {
    toast('Could not save — duplicate name?');
  }
}

/** @param {string} source */
function onPaintSourceClick(source) {
  if (!source) return;
  window.dispatchEvent(new CustomEvent('muster:filter-source', { detail: { source } }));
}

export function renderPaints() {
  const { paints } = getState();
  const types = ['All', ...new Set(paints.map(p => p.type).filter(Boolean))];
  const brands = ['All', ...new Set(paints.map(p => p.brand).filter(Boolean))].sort();

  document.getElementById('paintFilters').innerHTML = `
    <div class="filter-group"><span class="filter-label">Type</span>${types.map(t =>
    `<button class="chip ${paintFilter === t ? 'on' : ''}" data-t="${escapeAttr(t)}">${escapeHtml(t)}</button>`
  ).join('')}</div>
    <div class="filter-group"><span class="filter-label">Brand</span>${brands.map(b =>
    `<button class="chip ${brandFilter === b ? 'on' : ''}" data-b="${escapeAttr(b)}">${escapeHtml(b)}</button>`
  ).join('')}</div>
    <div class="filter-group"><span class="filter-label">Stock</span>
      <button class="chip ${lowOnly ? 'on' : ''}" data-low="1">Running low</button>
    </div>`;

  document.querySelectorAll('#paintFilters .chip[data-t]').forEach(c => {
    c.onclick = () => { paintFilter = c.dataset.t || 'All'; renderPaints(); };
  });
  document.querySelectorAll('#paintFilters .chip[data-b]').forEach(c => {
    c.onclick = () => { brandFilter = c.dataset.b || 'All'; renderPaints(); };
  });
  document.querySelectorAll('#paintFilters .chip[data-low]').forEach(c => {
    c.onclick = () => { lowOnly = !lowOnly; renderPaints(); };
  });

  const host = document.getElementById('paints');

  if (!paints.length) {
    host.innerHTML = `<div class="empty-state" id="paintsDrop">
      <h2>No paints yet</h2>
      <p>Import <code>warhammer_paint_inventory.csv</code>, use the template, or load the sample collection (includes armies + paints).</p>
      <div class="empty-actions">
        <button class="btn gold" id="emptyImportPaints">⬆ Import Paints CSV</button>
        <button class="btn" id="emptyTemplatePaints">📄 Download template</button>
        <button class="btn" id="emptyAddPaint">+ Add paint</button>
      </div>
      <div class="drop-zone">Drop paints CSV here</div>
    </div>`;
    document.getElementById('emptyImportPaints')?.addEventListener('click', () => {
      document.getElementById('fileInputPaints')?.click();
    });
    document.getElementById('emptyTemplatePaints')?.addEventListener('click', () => {
      downloadTemplate('paints');
      toast('Template downloaded');
    });
    document.getElementById('emptyAddPaint')?.addEventListener('click', () => addPaintFlow());
    wireDropZone(document.getElementById('paintsDrop'), 'paints');
    document.getElementById('paintStats').innerHTML = '';
    return;
  }

  const rows = filteredPaints();

  if (!rows.length && paintFiltersActive()) {
    host.innerHTML = `<div class="empty-state filtered-empty">
      <h2>No matching paints</h2>
      <p>Nothing matches your current search or filters.</p>
      <button class="btn gold" type="button" id="clearPaintFilters">Clear filters</button>
    </div>`;
    document.getElementById('clearPaintFilters')?.addEventListener('click', () => {
      clearPaintFilters();
      renderPaints();
    });
    return;
  }

  host.innerHTML = `<div class="paint-toolbar"><button class="btn" type="button" id="addPaintBtn">+ Add paint</button></div>`
    + rows.map(p => {
      const linked = unitsForSource(p.source);
      const parts = [p.type, p.brand].filter(Boolean).map(x => escapeHtml(x));
      if (p.source) {
        parts.push(`<button type="button" class="paint-link" data-src="${escapeAttr(p.source)}" title="Show ${linked} linked unit(s) on Armies tab">${escapeHtml(p.source)}${linked ? ` (${linked})` : ''}</button>`);
      }
      const meta = parts.length ? `<div class="pt">${parts.join(' · ')}</div>` : '';
      const note = p.notes ? `<div class="paint-note" title="${escapeAttr(p.notes)}">${escapeHtml(p.notes)}</div>` : '';
      return `<div class="paint${p.low ? ' paint-low' : ''}" data-name="${escapeAttr(p.name)}">
      <div class="swatch" style="background:${safeColor(p.swatch)}"></div>
      <div class="paint-body">
        <div class="pn">${escapeHtml(p.name)}${p.low ? ' <span class="low-badge">LOW</span>' : ''}</div>
        ${meta}
        ${note}
      </div>
      ${p.qty > 1 ? `<div class="qbadge">×${p.qty}</div>` : ''}
      <div class="paint-actions">
        <button type="button" class="btn sm paint-edit" title="Edit">✎</button>
        <button type="button" class="btn sm paint-del" title="Delete">✕</button>
      </div>
    </div>`;
    }).join('');

  document.getElementById('addPaintBtn')?.addEventListener('click', () => addPaintFlow());
  host.querySelectorAll('.paint-link').forEach(btn => {
    btn.addEventListener('click', () => onPaintSourceClick(btn.getAttribute('data-src') || ''));
  });
  host.querySelectorAll('.paint').forEach(card => {
    const name = card.getAttribute('data-name') || '';
    card.querySelector('.paint-edit')?.addEventListener('click', () => editPaintFlow(name));
    card.querySelector('.paint-del')?.addEventListener('click', async () => {
      if (await confirmDialog(`Remove paint "${name}"?`, { okLabel: 'Remove', danger: true })) {
        removePaint(name);
        renderPaints();
        toast('Paint removed');
      }
    });
  });

  const scoped = paintFiltersActive();
  const statRows = scoped ? rows : paints;
  const total = statRows.reduce((s, p) => s + (p.qty || 1), 0);
  const scopeLabel = scoped ? ' (filtered)' : '';
  document.getElementById('paintStats').innerHTML = [
    [statRows.length, `Distinct Paints${scopeLabel}`],
    [total, `Total Pots${scopeLabel}`, 1],
    [new Set(statRows.map(p => p.type).filter(Boolean)).size, `Types${scopeLabel}`],
  ].map(t =>
    `<div class="tile ${t[2] ? 'accent' : ''}"><div class="v">${t[0]}</div><div class="l">${escapeHtml(t[1])}</div></div>`
  ).join('');
}

export function bindPaintSearch() {
  document.getElementById('paintSearch')?.addEventListener('input', e => {
    paintSearch = /** @type {HTMLInputElement} */ (e.target).value;
    clearTimeout(paintSearchTimer);
    paintSearchTimer = setTimeout(() => renderPaints(), 200);
  });
}
