/** @param {string} source */
export function sourceParts(source) {
  if (!source) return [];
  return source.split('+').map(s => s.trim().toLowerCase()).filter(Boolean);
}

/** @param {string} paintSource @param {string} unitSource */
export function sourcesMatch(paintSource, unitSource) {
  const us = unitSource.toLowerCase();
  if (!us) return false;
  return sourceParts(paintSource).some(p => us.includes(p) || p.includes(us));
}
