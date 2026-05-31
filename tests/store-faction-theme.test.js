import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLocalStorageMock } from './helpers/localStorage.js';
import { DEFAULT_SETTINGS } from '../js/core/constants.js';

describe('reapplyArmyFactionDefaults', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('clears overrides and updates crest snapshot', async () => {
    const store = await import('../js/core/store.js');
    store.setCollection([{
      army: 'Test',
      game: '40k',
      faction: 'Necrons',
      crest: 'X',
      color: '#000000',
      crestOverride: 'YY',
      colorOverride: '#123456',
      units: [{ unit: 'Warriors', qty: 1, source: '', state: 'Unassembled' }],
    }]);
    store.patchSettings(structuredClone(DEFAULT_SETTINGS));

    expect(store.reapplyArmyFactionDefaults('Test')).toBe(true);
    const a = store.getState().collection[0];
    expect(a.crestOverride).toBeUndefined();
    expect(a.colorOverride).toBeUndefined();
    expect(a.crest).toBe('NC');
    expect(a.color).toBe('#1a5c3a');
  });
});
