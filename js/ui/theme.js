import { getState, patchSettings } from '../core/store.js';

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** @param {'dark'|'light'|'system'} theme */
export function resolveTheme(theme) {
  if (theme === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return theme;
}

const LABELS = { dark: 'Dark', light: 'Light', system: 'System' };
const NEXT = { dark: 'light', light: 'system', system: 'dark' };

/** @param {'dark'|'light'|'system'} preference */
function applyThemePreference(preference) {
  const resolved = resolveTheme(preference);
  document.documentElement.setAttribute('data-theme', resolved);
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.textContent = resolved === 'dark' ? '☀' : '☽';
    btn.setAttribute('aria-label', `Theme: ${LABELS[preference]}. Click to switch to ${LABELS[NEXT[preference]]}.`);
    btn.setAttribute('title', `Theme: ${LABELS[preference]} (click to cycle)`);
  }
}

export function initTheme() {
  const { settings } = getState();
  applyThemePreference(settings.theme);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { settings: s } = getState();
    if (s.theme === 'system') applyThemePreference('system');
  });
}

const CYCLE = /** @type {const} */ (['dark', 'light', 'system']);

export function toggleTheme() {
  const { settings } = getState();
  const i = CYCLE.indexOf(settings.theme);
  const next = CYCLE[(i + 1) % CYCLE.length];
  patchSettings({ theme: next });
  applyThemePreference(next);
}

export function initThemeToggle() {
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
}
