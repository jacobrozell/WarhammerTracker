import { musterArmiesImporter } from './muster-armies.js';
import { musterPaintsImporter } from './muster-paints.js';

/** @typedef {{ id: string, label: string, domain: 'armies'|'paints', detect: (rows: string[][]) => boolean, import: (rows: string[][], ctx: object) => import('../data/csv.js').ImportResult }} Importer */

/** @type {Importer[]} — add third-party importers here (future_ideas #5) */
export const IMPORTERS = [
  musterArmiesImporter,
  musterPaintsImporter,
];

/**
 * @param {string[][]} rows
 * @param {'armies'|'paints'|null} [expectedDomain]
 */
export function detectImporter(rows, expectedDomain = null) {
  const matches = IMPORTERS.filter(imp => imp.detect(rows));
  if (!matches.length) return null;
  if (expectedDomain) {
    const domainMatch = matches.find(m => m.domain === expectedDomain);
    return domainMatch || null;
  }
  return matches.length === 1 ? matches[0] : matches[0];
}

/**
 * @param {string[][]} rows
 * @param {object} ctx
 * @param {'armies'|'paints'|null} [expectedDomain]
 */
export function runImport(rows, ctx, expectedDomain = null) {
  const importer = detectImporter(rows, expectedDomain);
  if (!importer) {
    return {
      ok: false,
      errors: [expectedDomain
        ? `Unrecognised ${expectedDomain} CSV — check column headers.`
        : 'Unrecognised CSV format.'],
      warnings: [],
      stats: {},
    };
  }
  if (expectedDomain && importer.domain !== expectedDomain) {
    return {
      ok: false,
      errors: [`This looks like a ${importer.domain} file — use the ${expectedDomain} import.`],
      warnings: [],
      stats: {},
    };
  }
  return importer.import(rows, ctx);
}
