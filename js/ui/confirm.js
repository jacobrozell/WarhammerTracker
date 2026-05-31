/** @type {HTMLDialogElement|null} */
let dialog = null;

function ensureDialog() {
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.className = 'confirm-dialog';
  dialog.innerHTML = `
    <form method="dialog" class="confirm-form">
      <p class="confirm-msg" id="confirmMsg"></p>
      <div class="confirm-actions">
        <button class="btn" type="submit" value="cancel">Cancel</button>
        <button class="btn gold" type="submit" value="ok">OK</button>
      </div>
    </form>`;
  document.body.appendChild(dialog);
  return dialog;
}

/** @param {string} message @param {{ title?: string, okLabel?: string, danger?: boolean }} [opts] */
export function confirmDialog(message, opts = {}) {
  const d = ensureDialog();
  const msg = d.querySelector('.confirm-msg');
  const okBtn = d.querySelector('button[value="ok"]');
  if (msg) msg.textContent = message;
  if (okBtn) {
    okBtn.textContent = opts.okLabel || 'OK';
    okBtn.classList.toggle('gold', !opts.danger);
  }
  d.returnValue = 'cancel';
  d.showModal();
  return new Promise(resolve => {
    d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true });
  });
}

/** @param {string} message @param {{ title?: string }} [opts] */
export function importModeDialog(message, opts = {}) {
  const d = ensureDialog();
  const form = d.querySelector('.confirm-form');
  const msg = d.querySelector('.confirm-msg');
  if (msg) msg.textContent = message;
  if (form) {
    const actions = form.querySelector('.confirm-actions');
    if (actions) {
      actions.innerHTML = `
        <button class="btn" type="submit" value="cancel">Cancel</button>
        <button class="btn" type="submit" value="append">Append</button>
        <button class="btn gold" type="submit" value="replace">Replace</button>`;
    }
  }
  d.returnValue = 'cancel';
  d.showModal();
  return new Promise(resolve => {
    d.addEventListener('close', () => {
      const v = d.returnValue;
      if (form) {
        form.innerHTML = `
          <p class="confirm-msg" id="confirmMsg"></p>
          <div class="confirm-actions">
            <button class="btn" type="submit" value="cancel">Cancel</button>
            <button class="btn gold" type="submit" value="ok">OK</button>
          </div>`;
      }
      resolve(v === 'replace' || v === 'append' ? v : 'cancel');
    }, { once: true });
  });
}
