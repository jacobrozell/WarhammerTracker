import { getState } from '../core/store.js';
import { escapeHtml, escapeAttr, safeColor } from '../core/dom.js';
import { wireDropZone } from '../ui/dropzone.js';
import { downloadTemplate } from '../data/export.js';
import { toast } from '../ui/toast.js';

/** @type {string} */
let paintFilter = 'All';
/** @type {string} */
let paintSearch = '';

export function renderPaints() {
  const { paints } = getState();
  const types = ['All', ...new Set(paints.map(p => p.type).filter(Boolean))];

  document.getElementById('paintFilters').innerHTML = types.map(t =>
    `<button class="chip ${paintFilter === t ? 'on' : ''}" data-t="${escapeAttr(t)}">${escapeHtml(t)}</button>`
  ).join('');

  document.querySelectorAll('#paintFilters .chip').forEach(c => {
    c.onclick = () => { paintFilter = c.dataset.t || 'All'; renderPaints(); };
  });

  const host = document.getElementById('paints');

  if (!paints.length) {
    host.innerHTML = `<div class="empty-state" id="paintsDrop">
      <h2>No paints yet</h2>
      <p>Import a <code>warhammer_paint_inventory.csv</code> or start from the template.</p>
      <div class="empty-actions">
        <button class="btn gold" id="emptyImportPaints">⬆ Import Paints CSV</button>
        <button class="btn" id="emptyTemplatePaints">📄 Download template</button>
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
    wireDropZone(document.getElementById('paintsDrop'), 'paints');
    document.getElementById('paintStats').innerHTML = '';
    return;
  }

  const q = paintSearch.toLowerCase();
  const rows = paints.filter(p =>
    (paintFilter === 'All' || p.type === paintFilter) &&
    (!q || `${p.name} ${p.type} ${p.source || ''}`.toLowerCase().includes(q))
  );

  host.innerHTML = rows.map(p =>
    `<div class="paint">
      <div class="swatch" style="background:${safeColor(p.swatch)}"></div>
      <div><div class="pn">${escapeHtml(p.name)}</div><div class="pt">${escapeHtml(p.type)}${p.brand ? ` · ${escapeHtml(p.brand)}` : ''}</div></div>
      ${p.qty > 1 ? `<div class="qbadge">×${p.qty}</div>` : ''}
    </div>`
  ).join('');

  const total = paints.reduce((s, p) => s + (p.qty || 1), 0);
  document.getElementById('paintStats').innerHTML = [
    [paints.length, 'Distinct Paints'],
    [total, 'Total Pots', 1],
    [new Set(paints.map(p => p.type)).size, 'Types'],
  ].map(t =>
    `<div class="tile ${t[2] ? 'accent' : ''}"><div class="v">${t[0]}</div><div class="l">${escapeHtml(t[1])}</div></div>`
  ).join('');
}

export function bindPaintSearch() {
  document.getElementById('paintSearch')?.addEventListener('input', e => {
    paintSearch = /** @type {HTMLInputElement} */ (e.target).value;
    renderPaints();
  });
}
