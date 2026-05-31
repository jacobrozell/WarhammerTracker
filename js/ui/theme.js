import { getState, patchSettings } from '../core/store.js';

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** @param {'dark'|'light'|'system'} theme */
export function resolveTheme(theme) {
  if (theme === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return theme;
}

/** @param {'dark'|'light'} resolved */
function applyResolved(resolved) {
  document.documentElement.setAttribute('data-theme', resolved);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = resolved === 'dark' ? '☀' : '☽';
  btn?.setAttribute('aria-label', resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}

export function initTheme() {
  const { settings } = getState();
  applyResolved(resolveTheme(settings.theme));

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { settings: s } = getState();
    if (s.theme === 'system') applyResolved(resolveTheme('system'));
  });
}

export function toggleTheme() {
  const { settings } = getState();
  const current = resolveTheme(settings.theme);
  const next = current === 'dark' ? 'light' : 'dark';
  patchSettings({ theme: next });
  applyResolved(next);
}

export function initThemeToggle() {
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
}
