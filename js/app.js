import { load, subscribe, clearAllData, undoLast, canUndo, getState, setCollapsedArmies } from './core/store.js';
import { renderAll, renderArmyDomain } from './render/index.js';
import { renderPaints } from './render/paints.js';
import { bindArmySearch, bindArmyExpandCollapse, advanceVisibleUnits, applySourceFilterFromPaint } from './render/armies.js';
import { bindPaintSearch } from './render/paints.js';
import {
  handleImportFile,
  exportArmiesCSV,
  exportPaintsCSV,
  exportJSONBackup,
  importJSONBackup,
} from './import/index.js';
import { downloadTemplate } from './data/export.js';
import { loadDemoCollection } from './data/demo.js';
import { initModal } from './ui/modal.js';
import { initTheme, initThemeToggle } from './ui/theme.js';
import { toast } from './ui/toast.js';
import { initStorageSync, showFirstVisitBanner } from './ui/storage-sync.js';
import { confirmDialog } from './ui/confirm.js';
import { openPipelineSettings, openFactionSettings } from './ui/settings-panel.js';
import { checkBackupReminder } from './ui/backup-reminder.js';
import { initPwaInstall } from './ui/pwa-install.js';

let saveToastTimer;
let lastSaveToast = 0;
let undoFlashTimer;

function updateUndoButton() {
  const btn = document.getElementById('undoBtn');
  if (!btn) return;
  const ready = canUndo();
  btn.disabled = !ready;
  btn.setAttribute('aria-disabled', ready ? 'false' : 'true');
}

function flashUndoHint() {
  const btn = document.getElementById('undoBtn');
  if (!btn || btn.disabled) return;
  btn.classList.remove('undo-flash');
  void btn.offsetWidth;
  btn.classList.add('undo-flash');
  clearTimeout(undoFlashTimer);
  undoFlashTimer = setTimeout(() => btn.classList.remove('undo-flash'), 2800);
}

function debouncedSaveToast() {
  const now = Date.now();
  if (now - lastSaveToast < 4000) return;
  lastSaveToast = now;
  clearTimeout(saveToastTimer);
  saveToastTimer = setTimeout(() => toast('Saved locally', 1200), 400);
}

function updateTabBadges() {
  const { collection, paints } = getState();
  const units = collection.reduce((s, a) => s + a.units.length, 0);
  const tabA = document.querySelector('.tab[data-tab="armies"]');
  const tabP = document.querySelector('.tab[data-tab="paints"]');
  if (tabA) tabA.textContent = units ? `⚔ Armies (${units})` : '⚔ Armies';
  if (tabP) tabP.textContent = paints.length ? `🎨 Paint Rack (${paints.length})` : '🎨 Paint Rack';
}

function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(x => {
    x.classList.toggle('on', x.dataset.tab === tabId);
    x.setAttribute('aria-selected', x.dataset.tab === tabId ? 'true' : 'false');
  });
  const panelA = document.getElementById('tab-armies');
  const panelP = document.getElementById('tab-paints');
  panelA?.classList.toggle('hidden', tabId !== 'armies');
  panelP?.classList.toggle('hidden', tabId !== 'paints');
  panelA?.toggleAttribute('hidden', tabId !== 'armies');
  panelP?.toggleAttribute('hidden', tabId !== 'paints');
  location.hash = tabId === 'paints' ? 'paints' : '';
  updateTabBadges();
  const panel = tabId === 'paints' ? panelP : panelA;
  panel?.querySelector('.search, .btn, button')?.focus();
}

function bindTabs() {
  const tablist = document.querySelector('.tabs');
  tablist?.setAttribute('role', 'tablist');
  document.querySelectorAll('.tab').forEach(tab => {
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', tab.classList.contains('on') ? 'true' : 'false');
    tab.addEventListener('click', () => switchTab(tab.dataset.tab || 'armies'));
    tab.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const tabs = [...document.querySelectorAll('.tab')];
      const i = tabs.indexOf(tab);
      const next = tabs[i + (e.key === 'ArrowRight' ? 1 : -1)] || tabs[0];
      next.focus();
      switchTab(next.dataset.tab || 'armies');
    });
  });
  if (location.hash === '#paints') switchTab('paints');
}

function bindImportExport() {
  const fiA = document.getElementById('fileInputArmies');
  const fiP = document.getElementById('fileInputPaints');

  document.getElementById('importBtn')?.addEventListener('click', () => fiA?.click());
  document.getElementById('importBtn2')?.addEventListener('click', () => fiP?.click());
  document.getElementById('importAppendArmies')?.addEventListener('click', () => fiA?.click());
  document.getElementById('importAppendPaints')?.addEventListener('click', () => fiP?.click());

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

  /** @type {'replace'|'append'} */ let armyImportMode = 'replace';
  document.getElementById('importAppendArmies')?.addEventListener('mousedown', () => { armyImportMode = 'append'; });
  document.getElementById('importBtn')?.addEventListener('mousedown', () => { armyImportMode = 'replace'; });

  fiA?.addEventListener('change', e => {
    const input = /** @type {HTMLInputElement} */ (e.target);
    if (input.files?.[0]) handleImportFile(input.files[0], 'armies', armyImportMode);
    input.value = '';
    armyImportMode = 'replace';
  });

  /** @type {'replace'|'append'} */ let paintImportMode = 'replace';
  document.getElementById('importAppendPaints')?.addEventListener('mousedown', () => { paintImportMode = 'append'; });
  document.getElementById('importBtn2')?.addEventListener('mousedown', () => { paintImportMode = 'replace'; });

  fiP?.addEventListener('change', e => {
    const input = /** @type {HTMLInputElement} */ (e.target);
    if (input.files?.[0]) handleImportFile(input.files[0], 'paints', paintImportMode);
    input.value = '';
    paintImportMode = 'replace';
  });

  document.getElementById('exportBackup')?.addEventListener('click', exportJSONBackup);
  document.getElementById('importBackup')?.addEventListener('click', () => {
    document.getElementById('fileInputBackup')?.click();
  });
  document.getElementById('fileInputBackup')?.addEventListener('change', e => {
    const input = /** @type {HTMLInputElement} */ (e.target);
    if (input.files?.[0]) importJSONBackup(input.files[0]);
    input.value = '';
  });

  document.getElementById('clearAllBtn')?.addEventListener('click', async () => {
    if (await confirmDialog('Delete all armies, paints, and settings in this browser?', { okLabel: 'Clear all', danger: true })) {
      clearAllData();
      renderAll();
      toast('All data cleared');
    }
  });

  document.getElementById('pipelineSettings')?.addEventListener('click', async () => {
    await openPipelineSettings();
    renderArmyDomain();
  });

  document.getElementById('factionSettings')?.addEventListener('click', async () => {
    await openFactionSettings();
    renderArmyDomain();
  });

  document.getElementById('loadDemo')?.addEventListener('click', async () => {
    const { collection, paints } = getState();
    if (collection.length || paints.length) {
      if (!await confirmDialog('Load sample collection? This replaces your current armies and paints.', { okLabel: 'Load sample', danger: true })) {
        return;
      }
    }
    if (await loadDemoCollection()) renderAll();
  });

  document.getElementById('undoBtn')?.addEventListener('click', () => {
    if (undoLast()) {
      renderArmyDomain();
      renderPaints();
      toast('Undone');
    } else toast('Nothing to undo');
    updateUndoButton();
  });

  document.getElementById('advanceVisible')?.addEventListener('click', () => {
    const n = advanceVisibleUnits();
    if (n > 0) {
      toast(`Advanced ${n} visible unit${n === 1 ? '' : 's'} — ↩ Undo or Ctrl+Z`, 3500);
      updateUndoButton();
      flashUndoHint();
    } else toast('Nothing to advance in the current view');
  });
}

function bindGlobalDrop() {
  const wrap = document.querySelector('.wrap');
  if (!wrap || wrap.dataset.dropWired) return;
  wrap.dataset.dropWired = '1';
  let drag = 0;
  wrap.addEventListener('dragenter', e => {
    e.preventDefault();
    drag++;
    wrap.classList.add('global-drag');
  });
  wrap.addEventListener('dragleave', () => {
    drag--;
    if (drag <= 0) { drag = 0; wrap.classList.remove('global-drag'); }
  });
  wrap.addEventListener('dragover', e => e.preventDefault());
  wrap.addEventListener('drop', e => {
    e.preventDefault();
    drag = 0;
    wrap.classList.remove('global-drag');
    const f = e.dataTransfer?.files[0];
    if (!f) return;
    const onPaints = !document.getElementById('tab-paints')?.classList.contains('hidden');
    handleImportFile(f, onPaints ? 'paints' : 'armies');
  });
}

function init() {
  load();
  initTheme();
  initThemeToggle();
  initModal();
  initStorageSync();
  showFirstVisitBanner();
  checkBackupReminder();
  initPwaInstall();
  bindTabs();
  bindImportExport();
  bindArmySearch();
  bindArmyExpandCollapse();
  bindPaintSearch();
  bindGlobalDrop();
  updateTabBadges();

  window.addEventListener('muster:filter-source', e => {
    const source = /** @type {CustomEvent} */ (e).detail?.source;
    if (!source) return;
    switchTab('armies');
    applySourceFilterFromPaint(source);
    toast(`Filtered armies by source`);
  });

  document.addEventListener('keydown', e => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const tag = /** @type {HTMLElement} */ (e.target).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      const onPaints = !document.getElementById('tab-paints')?.classList.contains('hidden');
      document.getElementById(onPaints ? 'paintSearch' : 'search')?.focus();
    }
  });

  window.addEventListener('beforeprint', () => {
    setCollapsedArmies(new Set());
    renderArmyDomain();
  });

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      if (undoLast()) {
        renderArmyDomain();
        renderPaints();
        toast('Undone');
        updateUndoButton();
      }
    }
  });

  subscribe((reason, detail) => {
    const silent = detail && typeof detail === 'object' && 'silent' in detail && detail.silent;

    if (reason === 'collection' && !silent) renderArmyDomain();
    else if (reason === 'settings') {
      if (detail && typeof detail === 'object' && 'pipeline' in detail) renderArmyDomain();
      else if (detail && typeof detail === 'object' && 'theme' in detail) initTheme();
    }
    else if (reason === 'paints') renderPaints();
    else if (reason === 'all') renderAll();

    if (reason === 'collection' && !silent) debouncedSaveToast();
    else if ((reason === 'paints' || reason === 'all') && !silent) debouncedSaveToast();
    if (reason === 'save-error' && detail && typeof detail === 'object' && 'message' in detail) {
      toast(/** @type {{ message: string }} */ (detail).message, 3000);
    }
    if (reason === 'load-error' && detail && typeof detail === 'object' && 'message' in detail) {
      toast(/** @type {{ message: string }} */ (detail).message, 3000);
    }
    if (reason === 'storage-warn' && detail && typeof detail === 'object' && 'message' in detail) {
      toast(/** @type {{ message: string }} */ (detail).message, 5000);
    }
    updateTabBadges();
    if (reason === 'collection' || reason === 'paints' || reason === 'all') updateUndoButton();
  });

  updateUndoButton();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  renderAll();
}

init();
