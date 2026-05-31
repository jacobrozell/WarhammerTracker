const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** @param {unknown} str */
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => HTML_ESC[/** @type {keyof typeof HTML_ESC} */ (c)]);
}

/** @param {unknown} str */
export function escapeAttr(str) {
  return escapeHtml(str);
}

/** Restrict user-supplied colors to safe CSS values. */
export function safeColor(color) {
  const s = String(color ?? '').trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  return '#888';
}
