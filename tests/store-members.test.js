import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLocalStorageMock } from './helpers/localStorage.js';
import { DEFAULT_SETTINGS } from '../js/core/constants.js';
import { hasSquadMembers } from '../js/core/members.js';

describe('store squad members', () => {
  /** @type {ReturnType<typeof createLocalStorageMock>} */
  let storage;

  beforeEach(() => {
    storage = createLocalStorageMock();
    vi.stubGlobal('localStorage', storage);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function freshStore() {
    const store = await import('../js/core/store.js');
    store.setCollection([]);
    store.patchSettings(structuredClone(DEFAULT_SETTINGS));
    return store;
  }

  it('enableSquadMembers initializes members for multi-model units', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'GK',
      game: '40k',
      faction: 'Grey Knights',
      crest: 'GK',
      color: '#888',
      units: [{ unit: 'Terminators (5)', qty: 1, source: '', state: 'Magnetising' }],
    }]);
    expect(store.enableSquadMembers('GK', 0)).toBe(true);
    const u = store.getState().collection[0].units[0];
    expect(hasSquadMembers(u)).toBe(true);
    expect(u.members).toHaveLength(5);
  });

  it('enableSquadMembers rejects single-model units', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'GK',
      game: '40k',
      faction: 'Grey Knights',
      crest: 'GK',
      color: '#888',
      units: [{ unit: 'Captain', qty: 1, source: '', state: 'Unassembled' }],
    }]);
    expect(store.enableSquadMembers('GK', 0)).toBe(false);
  });

  it('updateMember patches one model', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'GK',
      game: '40k',
      faction: 'Grey Knights',
      crest: 'GK',
      color: '#888',
      units: [{ unit: 'Terminators (5)', qty: 1, source: '', state: 'Magnetising', members: [{}, {}, {}, {}, {}] }],
    }]);
    expect(store.updateMember('GK', 0, 2, { state: 'Primed', notes: 'ahead' })).toBe(true);
    expect(store.getState().collection[0].units[0].members[2].state).toBe('Primed');
    expect(store.getState().collection[0].units[0].members[0].state).toBeUndefined();
  });

  it('changing squad state does not copy into member overrides', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'GK',
      game: '40k',
      faction: 'Grey Knights',
      crest: 'GK',
      color: '#888',
      units: [{
        unit: 'Terminators (5)',
        qty: 1,
        source: '',
        state: 'Magnetising',
        members: [{}, {}, { state: 'Primed' }, {}, {}],
      }],
    }]);
    store.updateUnit('GK', 0, { state: 'Magnetised' });
    const u = store.getState().collection[0].units[0];
    expect(u.state).toBe('Magnetised');
    expect(u.members[2].state).toBe('Primed');
    expect(u.members[0].state).toBeUndefined();
  });
});
