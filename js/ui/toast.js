let timer;

/** @param {string} message */
export function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('show'), 1600);
}

/** @param {() => void} onSave */
export function toastSaved(onSave) {
  onSave();
  toast('Saved locally');
}
