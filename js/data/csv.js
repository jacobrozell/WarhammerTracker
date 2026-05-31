/** @param {string} text */
export function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cur = '';
  let q = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }

  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

/** @param {unknown} c */
export function escapeCSV(c) {
  c = String(c == null ? '' : c);
  return /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c;
}

/** @param {string[][]} rows */
export function serializeCSV(rows) {
  return rows.map(r => r.map(escapeCSV).join(',')).join('\n');
}

/** @param {string} text @param {string} filename */
export function downloadText(text, filename, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** @param {string[][]} rows @param {string[]} required */
export function headerMap(rows, required = []) {
  if (!rows.length) return { ok: false, error: 'File is empty' };
  const head = rows[0].map(h => String(h).trim().toLowerCase());
  const col = /** @param {string} n */ n => head.indexOf(n);
  const missing = required.filter(h => col(h) < 0);
  if (missing.length) {
    return { ok: false, error: `Missing required columns: ${missing.join(', ')}`, head, col };
  }
  return { ok: true, head, col };
}

/** @param {unknown} raw @param {number} [def] */
export function normalizeQty(raw, def = 1) {
  const s = String(raw ?? '').trim();
  if (!s) return { qty: def };
  const n = +s;
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    return { qty: def, warn: `Invalid Qty "${raw}" — using ${def}` };
  }
  return { qty: n };
}

/** @param {unknown} raw */
export function normalizeBool(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return { val: undefined };
  if (['yes', 'y', 'true', '1'].includes(s)) return { val: true };
  if (['no', 'n', 'false', '0'].includes(s)) return { val: false };
  return { val: undefined, warn: `Unrecognised boolean value "${raw}" — ignored` };
}

/** @typedef {{ ok: boolean, errors: string[], warnings: string[], stats: Record<string, number>, data?: unknown }} ImportResult */

export const emptyResult = () => ({ ok: false, errors: [], warnings: [], stats: {} });
