import { STORAGE_KEY } from '../core/constants.js';
import { load } from '../core/store.js';
import { renderAll } from '../render/index.js';
import { toast } from './toast.js';

let bannerEl = null;

function showBanner() {
  if (bannerEl) return;
  bannerEl = document.createElement('div');
  bannerEl.className = 'storage-banner';
  bannerEl.setAttribute('role', 'alert');
  bannerEl.innerHTML = `
    <span>Data changed in another tab. Reload to use that version (this tab's unsaved edits are lost).</span>
    <button type="button" class="btn gold" data-act="reload">Reload</button>
    <button type="button" class="btn" data-act="dismiss">Keep editing here</button>`;
  document.querySelector('.wrap')?.prepend(bannerEl);
  bannerEl.querySelector('[data-act="reload"]')?.addEventListener('click', () => {
    load();
    renderAll();
    bannerEl?.remove();
    bannerEl = null;
    toast('Reloaded from storage');
  });
  bannerEl.querySelector('[data-act="dismiss"]')?.addEventListener('click', () => {
    bannerEl?.remove();
    bannerEl = null;
  });
}

export function initStorageSync() {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue != null) showBanner();
  });
}

export function showFirstVisitBanner() {
  const key = 'musterRoll.seenBanner';
  if (localStorage.getItem(key)) return;
  const el = document.createElement('div');
  el.className = 'storage-banner info';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <span>Data stays in this browser only. Private browsing may not persist saves. Use Full backup regularly.</span>
    <button type="button" class="btn gold" data-act="ok">Got it</button>`;
  document.querySelector('.wrap')?.prepend(el);
  el.querySelector('[data-act="ok"]')?.addEventListener('click', () => {
    localStorage.setItem(key, '1');
    el.remove();
  });
}
