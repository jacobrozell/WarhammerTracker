import { escapeHtml } from '../core/dom.js';

/** @returns {HTMLDialogElement|null} */
function getImportDialog() {
  const el = document.getElementById('importModal');
  return el instanceof HTMLDialogElement ? el : null;
}

export function closeImportModal() {
  const dialog = getImportDialog();
  if (dialog?.open) dialog.close();
}

/** @param {import('../data/csv.js').ImportResult} result */
export function showImportResult(title, result) {
  const dialog = getImportDialog();
  const body = document.getElementById('importModalBody');
  const titleEl = document.getElementById('importModalTitle');
  if (!dialog || !body || !titleEl) return;

  titleEl.textContent = title;
  let html = '';

  if (result.ok) {
    const parts = result.stats.armies != null
      ? `${result.stats.armies} ${result.stats.armies === 1 ? 'army' : 'armies'}, ${result.stats.units} unit entries`
      : `${result.stats.paints} paints`;
    html += `<p class="ok">Imported ${escapeHtml(parts)}.</p>`;
    if (result.replaced) {
      html += `<p class="warn">Replaced previous data (${escapeHtml(result.replaced)}).</p>`;
    }
  } else {
    html += '<p class="err">Import failed.</p>';
  }

  if (result.errors.length) {
    html += `<p class="err">Errors:</p><ul>${result.errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`;
  }

  if (result.warnings.length) {
    const show = result.warnings.slice(0, 8);
    html += `<p class="warn"><strong>${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}</strong> — review before continuing:</p>`;
    html += `<ul class="import-warn-list">${show.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`;
    if (result.warnings.length > 8) {
      html += `<details class="import-warn-more"><summary>Show all ${result.warnings.length} warnings</summary><ul>${result.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul></details>`;
    }
    html += `<button type="button" class="btn sm" id="copyImportWarnings">Copy warnings</button>`;
  }

  body.innerHTML = html;
  if (!dialog.open) dialog.showModal();
  document.getElementById('copyImportWarnings')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(result.warnings.join('\n'));
  });
  document.getElementById('importModalOk')?.focus();
}

export function initModal() {
  const dialog = getImportDialog();
  if (!dialog) return;

  document.getElementById('importModalClose')?.addEventListener('click', closeImportModal);
  document.getElementById('importModalOk')?.addEventListener('click', closeImportModal);
  dialog.addEventListener('click', e => {
    if (e.target === dialog) closeImportModal();
  });
}
