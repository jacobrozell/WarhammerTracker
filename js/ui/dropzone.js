import { handleImportFile } from '../import/index.js';

/**
 * @param {HTMLElement|null} el
 * @param {'armies'|'paints'} expected
 */
export function wireDropZone(el, expected) {
  if (!el || el.dataset.dropWired) return;
  el.dataset.dropWired = '1';

  const zone = el.querySelector('.drop-zone');
  if (!zone) return;

  const over = (e) => { e.preventDefault(); zone.classList.add('drag'); };
  const leave = () => zone.classList.remove('drag');
  const drop = (e) => {
    e.preventDefault();
    zone.classList.remove('drag');
    const f = e.dataTransfer?.files[0];
    if (f) handleImportFile(f, expected);
  };

  el.addEventListener('dragover', over);
  el.addEventListener('dragleave', leave);
  el.addEventListener('drop', drop);
}
