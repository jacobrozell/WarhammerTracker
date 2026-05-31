import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLocalStorageMock } from './helpers/localStorage.js';
import { DEFAULT_SETTINGS } from '../js/core/constants.js';

function stubDom(prefersDark = true) {
  vi.stubGlobal('window', {
    matchMedia: vi.fn().mockImplementation(() => ({
      matches: prefersDark,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  vi.stubGlobal('document', {
    documentElement: { setAttribute: vi.fn() },
    getElementById: vi.fn(() => null),
  });
}

describe('theme — backlog (todo: dark / light / system)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    stubDom(true);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolveTheme maps system to prefers-color-scheme', async () => {
    const { resolveTheme } = await import('../js/ui/theme.js');
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('system')).toBe('dark');

    vi.unstubAllGlobals();
    stubDom(false);
    vi.resetModules();
    const { resolveTheme: resolve2 } = await import('../js/ui/theme.js');
    expect(resolve2('system')).toBe('light');
  });

  it('toggleTheme cycles dark → light → system', async () => {
    const store = await import('../js/core/store.js');
    store.patchSettings(structuredClone(DEFAULT_SETTINGS));

    const { toggleTheme } = await import('../js/ui/theme.js');
    expect(store.getState().settings.theme).toBe('dark');

    toggleTheme();
    expect(store.getState().settings.theme).toBe('light');

    toggleTheme();
    expect(store.getState().settings.theme).toBe('system');

    toggleTheme();
    expect(store.getState().settings.theme).toBe('dark');
  });
});
