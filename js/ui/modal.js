/** @param {import('../data/csv.js').ImportResult} result */
export function showImportResult(title, result) {
  const modal = document.getElementById('importModal');
  const body = document.getElementById('importModalBody');
  const titleEl = document.getElementById('importModalTitle');
  if (!modal || !body || !titleEl) return;

  titleEl.textContent = title;
  let html = '';

  if (result.ok) {
    const parts = result.stats.armies != null
      ? `${result.stats.armies} ${result.stats.armies === 1 ? 'army' : 'armies'}, ${result.stats.units} unit entries`
      : `${result.stats.paints} paints`;
    html += `<p class="ok">Imported ${parts}.</p>`;
  } else {
    html += '<p class="err">Import failed.</p>';
  }

  if (result.errors.length) {
    html += `<p class="err">Errors:</p><ul>${result.errors.map(e => `<li>${e}</li>`).join('')}</ul>`;
  }

  if (result.warnings.length) {
    const show = result.warnings.slice(0, 12);
    html += `<p class="warn">Warnings (${result.warnings.length}):</p><ul>${show.map(w => `<li>${w}</li>`).join('')}</ul>`;
    if (result.warnings.length > 12) {
      html += `<p class="warn">…and ${result.warnings.length - 12} more.</p>`;
    }
  }

  body.innerHTML = html;
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
}

export function closeImportModal() {
  const modal = document.getElementById('importModal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
}

export function initModal() {
  document.getElementById('importModalClose')?.addEventListener('click', closeImportModal);
  document.getElementById('importModalOk')?.addEventListener('click', closeImportModal);
  document.getElementById('importModal')?.addEventListener('click', e => {
    if (e.target?.id === 'importModal') closeImportModal();
  });
}
