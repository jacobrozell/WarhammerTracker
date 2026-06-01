/** @param {string} [notes] */
export function extractTags(notes) {
  return (notes?.match(/#[\w-]+/g) || []).map(t => t.slice(1).toLowerCase());
}
