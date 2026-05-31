/** @type {BeforeInstallPromptEvent|null} */
let deferredPrompt = null;

export function initPwaInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });
}

function showInstallBanner() {
  if (document.getElementById('pwaInstallBanner') || localStorage.getItem('musterRoll.pwaDismiss')) return;
  const el = document.createElement('div');
  el.id = 'pwaInstallBanner';
  el.className = 'storage-banner info';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <span>Install The Muster Roll for quick access at your desk.</span>
    <button type="button" class="btn gold" data-act="install">Install</button>
    <button type="button" class="btn" data-act="dismiss">Not now</button>`;
  document.querySelector('.wrap')?.prepend(el);
  el.querySelector('[data-act="install"]')?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    el.remove();
  });
  el.querySelector('[data-act="dismiss"]')?.addEventListener('click', () => {
    localStorage.setItem('musterRoll.pwaDismiss', '1');
    el.remove();
  });
}
