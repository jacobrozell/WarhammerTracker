import { load, subscribe } from './core/store.js';
import { renderAll, renderArmyDomain } from './render/index.js';
import { renderPaints } from './render/paints.js';
import { bindArmySearch, bindArmyExpandCollapse } from './render/armies.js';
import { bindPaintSearch } from './render/paints.js';
import {
  handleImportFile,
  exportArmiesCSV,
  exportPaintsCSV,
} from './import/index.js';
import { downloadTemplate } from './data/export.js';
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
  document.getElementById('templateArmies')?.addEventListener('click', () => {
    downloadTemplate('armies');
    toast('Template downloaded');
  });
  document.getElementById('templatePaints')?.addEventListener('click', () => {
    downloadTemplate('paints');
    toast('Template downloaded');
  });
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

  subscribe((reason, detail) => {
    if (reason === 'collection' || reason === 'settings') renderArmyDomain();
    else if (reason === 'paints') renderPaints();
    else if (reason === 'all') renderAll();

    if (reason === 'collection' || reason === 'paints' || reason === 'settings' || reason === 'all') {
      toast('Saved locally');
    }
    if (reason === 'save-error' && detail && typeof detail === 'object' && 'message' in detail) {
      toast(/** @type {{ message: string }} */ (detail).message);
    }
    if (reason === 'load-error' && detail && typeof detail === 'object' && 'message' in detail) {
      toast(/** @type {{ message: string }} */ (detail).message);
    }
  });

  renderAll();
}

init();
