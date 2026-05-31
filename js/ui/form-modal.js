import { escapeHtml, escapeAttr } from '../core/dom.js';
import { closeImportModal } from './modal.js';

/** @typedef {{ id: string, label: string, type?: string, value?: string, options?: string[], optgroups?: Record<string, string[]>, min?: number }} Field */

/** @returns {HTMLDialogElement|null} */
function getImportDialog() {
  const el = document.getElementById('importModal');
  return el instanceof HTMLDialogElement ? el : null;
}

/** @param {string} title @param {Field[]} fields */
export function formDialog(title, fields) {
  return new Promise(resolve => {
    const dialog = getImportDialog();
    const body = document.getElementById('importModalBody');
    const titleEl = document.getElementById('importModalTitle');
    const ok = document.getElementById('importModalOk');
    if (!dialog || !body || !titleEl || !ok) {
      resolve(null);
      return;
    }

    titleEl.textContent = title;
    body.innerHTML = `<form id="dynForm" class="dyn-form">${fields.map(f => {
      if (f.optgroups) {
        const groups = Object.entries(f.optgroups).map(([group, items]) => {
          const opts = items.map(o =>
            `<option value="${escapeAttr(o)}"${o === f.value ? ' selected' : ''}>${escapeHtml(o)}</option>`
          ).join('');
          return `<optgroup label="${escapeAttr(group)}">${opts}</optgroup>`;
        }).join('');
        return `<label>${escapeHtml(f.label)}<select name="${escapeAttr(f.id)}"><option value="">—</option>${groups}</select></label>`;
      }
      if (f.options) {
        const opts = f.options.map(o =>
          `<option value="${escapeAttr(o)}"${o === f.value ? ' selected' : ''}>${escapeHtml(o)}</option>`
        ).join('');
        return `<label>${escapeHtml(f.label)}<select name="${escapeAttr(f.id)}">${opts}</select></label>`;
      }
      if (f.type === 'textarea') {
        return `<label>${escapeHtml(f.label)}<textarea name="${escapeAttr(f.id)}" rows="8">${escapeHtml(f.value || '')}</textarea></label>`;
      }
      const type = f.type || 'text';
      const extra = type === 'number' && f.min != null ? ` min="${f.min}"` : '';
      return `<label>${escapeHtml(f.label)}<input name="${escapeAttr(f.id)}" type="${type}" value="${escapeAttr(f.value || '')}"${extra}></label>`;
    }).join('')}</form>`;

    const prevLabel = ok.textContent;
    const prevOnClick = ok.onclick;

    const finish = (/** @type {Record<string, string>|null} */ data) => {
      ok.textContent = prevLabel;
      ok.onclick = prevOnClick;
      closeImportModal();
      resolve(data);
    };

    ok.textContent = 'Save';
    ok.onclick = (e) => {
      e.preventDefault();
      const form = document.getElementById('dynForm');
      if (!(form instanceof HTMLFormElement)) return finish(null);
      const data = /** @type {Record<string, string>} */ ({});
      new FormData(form).forEach((v, k) => { data[k] = String(v); });
      finish(data);
    };

    document.getElementById('importModalClose')?.addEventListener('click', () => finish(null), { once: true });
    if (!dialog.open) dialog.showModal();
    const firstField = body.querySelector('input,select,textarea');
    firstField?.focus();
  });
}
