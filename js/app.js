import { load, subscribe } from './core/store.js';
import { renderAll } from './render/index.js';
import { bindArmySearch, bindArmyExpandCollapse } from './render/armies.js';
import { bindPaintSearch } from './render/paints.js';
import {
  handleImportFile,
  downloadTemplate,
  exportArmiesCSV,
  exportPaintsCSV,
} from './import/index.js';
import { initModal } from './ui/modal.js';
import { initTheme, initThemeToggle } from './ui/theme.js';
import { toast } from './ui/toast.js';

function bindTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
      tab.classList.add('on');
      document.getElementById('tab-armies')?.classList.toggle('hidden', tab.dataset.tab !== 'armies');
      document.getElementById('tab-paints')?.classList.toggle('hidden', tab.dataset.tab !== 'paints');
    });
  });
}

function bindImportExport() {
  const fiA = document.getElementById('fileInputArmies');
  const fiP = document.getElementById('fileInputPaints');

  document.getElementById('importBtn')?.addEventListener('click', () => fiA?.click());
  document.getElementById('importBtn2')?.addEventListener('click', () => fiP?.click());
  document.getElementById('templateArmies')?.addEventListener('click', () => downloadTemplate('armies'));
  document.getElementById('templatePaints')?.addEventListener('click', () => downloadTemplate('paints'));
  document.getElementById('exportArmies')?.addEventListener('click', exportArmiesCSV);
  document.getElementById('exportPaints')?.addEventListener('click', exportPaintsCSV);

  fiA?.addEventListener('change', e => {
    const input = /** @type {HTMLInputElement} */ (e.target);
    if (input.files?.[0]) handleImportFile(input.files[0], 'armies');
    input.value = '';
  });
  fiP?.addEventListener('change', e => {
    const input = /** @type {HTMLInputElement} */ (e.target);
    if (input.files?.[0]) handleImportFile(input.files[0], 'paints');
    input.value = '';
  });
}

function init() {
  load();
  initTheme();
  initThemeToggle();
  initModal();
  bindTabs();
  bindImportExport();
  bindArmySearch();
  bindArmyExpandCollapse();
  bindPaintSearch();

  subscribe(reason => {
    renderAll();
    if (reason === 'save') toast('Saved locally');
  });

  renderAll();
}

init();
