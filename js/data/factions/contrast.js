import { FACTION_DEFS } from './defs.js';

/** Matches css/tokens.css --surface */
export const THEME_SURFACES = {
  dark: '#15171e',
  light: '#fffdf8',
};

/** @param {string} hex */
export function parseHexColor(hex) {
  const s = String(hex || '').trim();
  let h = s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    h = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(h)) return null;
  return /** @type {[number, number, number]} */ ([
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ]);
}

/** @param {[number, number, number]} rgb */
export function relativeLuminance([r, g, b]) {
  const lin = [r, g, b].map(c => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** @param {string} fg @param {string} bg */
export function contrastRatio(fg, bg) {
  const a = parseHexColor(fg);
  const b = parseHexColor(bg);
  if (!a || !b) return 0;
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Faction accent colours below minRatio against a theme surface.
 * @param {number} [minRatio] WCAG-ish minimum for UI accents (default 3)
 * @param {import('./defs.js').FactionDef[]} [defs]
 */
export function auditFactionContrasts(minRatio = 3, defs = FACTION_DEFS) {
  /** @type {{ label: string, game: string, theme: 'dark'|'light', ratio: number, color: string }[]} */
  const issues = [];
  for (const d of defs) {
    for (const game of d.games) {
      for (const [theme, surface] of Object.entries(THEME_SURFACES)) {
        const ratio = contrastRatio(d.color, surface);
        if (ratio < minRatio) {
          issues.push({
            label: d.label,
            game,
            theme: /** @type {'dark'|'light'} */ (theme),
            ratio: Math.round(ratio * 100) / 100,
            color: d.color,
          });
        }
      }
    }
  }
  return issues;
}
