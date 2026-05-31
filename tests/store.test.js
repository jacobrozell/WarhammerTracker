import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLocalStorageMock } from './helpers/localStorage.js';
import {
  APP_VERSION,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  LEGACY_THEME_KEY,
  DEFAULT_SETTINGS,
} from '../js/core/constants.js';

describe('store', () => {
  /** @type {ReturnType<typeof createLocalStorageMock>} */
  let storage;

  beforeEach(async () => {
    storage = createLocalStorageMock();
    vi.stubGlobal('localStorage', storage);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function loadStore() {
    return import('../js/core/store.js');
  }

  async function freshStore() {
    const store = await loadStore();
    store.setCollection([]);
    store.setPaints([]);
    store.patchSettings(structuredClone(DEFAULT_SETTINGS));
    return store;
  }

  it('setCollection persists and notifies subscribers', async () => {
    const store = await freshStore();
    const reasons = [];
    store.subscribe(r => reasons.push(r));

    store.setCollection([{
      army: 'Test Army',
      game: '40k',
      faction: 'Ultramarines',
      crest: 'UM',
      color: '#1c4fa0',
      units: [{ unit: 'Intercessors', qty: 1, source: '', state: 'Unassembled' }],
    }]);

    expect(store.getState().collection).toHaveLength(1);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)).version).toBe(APP_VERSION);
    expect(reasons).toContain('collection');
  });

  it('updateUnit patches a unit in place', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'Test Army',
      game: '40k',
      faction: 'Ultramarines',
      crest: 'UM',
      color: '#1c4fa0',
      units: [{ unit: 'Intercessors', qty: 1, source: '', state: 'Unassembled' }],
    }]);

    expect(store.updateUnit('Test Army', 0, { state: 'Primed', notes: 'started' })).toBe(true);
    expect(store.getState().collection[0].units[0].state).toBe('Primed');
    expect(store.getState().collection[0].units[0].notes).toBe('started');
  });

  it('removeUnit and addUnit mutate collection', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'Test Army',
      game: '40k',
      faction: 'Ultramarines',
      crest: 'UM',
      color: '#1c4fa0',
      units: [
        { unit: 'A', qty: 1, source: '', state: 'Unassembled' },
        { unit: 'B', qty: 1, source: '', state: 'Unassembled' },
      ],
    }]);

    expect(store.removeUnit('Test Army', 0)).toBe(true);
    expect(store.getState().collection[0].units).toHaveLength(1);
    expect(store.getState().collection[0].units[0].unit).toBe('B');

    expect(store.addUnit('Test Army', { unit: 'C', qty: 1, source: '', state: 'Unassembled' })).toBe(true);
    expect(store.getState().collection[0].units).toHaveLength(2);
  });

  it('returns false for invalid unit operations', async () => {
    const store = await freshStore();
    expect(store.updateUnit('Missing', 0, { state: 'Primed' })).toBe(false);
    expect(store.removeUnit('Missing', 0)).toBe(false);
    expect(store.addUnit('Missing', { unit: 'X', qty: 1, source: '', state: 'Unassembled' })).toBe(false);
  });

  it('migrates legacy v2 storage', async () => {
    storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({
      c: [{
        army: 'Legacy Army',
        game: 'AoS',
        faction: 'Skaven',
        crest: 'SK',
        color: '#888',
        units: [{ unit: 'Rat', qty: 1, source: '', state: 'Unassembled' }],
      }],
      p: [{ name: 'Red', type: 'Base', swatch: '#f00', qty: 1, brand: '', source: '', notes: '' }],
    }));

    const store = await loadStore();
    store.load();

    expect(store.getState().collection[0].army).toBe('Legacy Army');
    expect(store.getState().paints[0].name).toBe('Red');
    expect(storage.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it('migrates legacy theme key into settings', async () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: APP_VERSION,
      collection: [],
      paints: [],
      settings: DEFAULT_SETTINGS,
    }));
    storage.setItem(LEGACY_THEME_KEY, 'light');

    const store = await loadStore();
    store.load();

    expect(store.getState().settings.theme).toBe('light');
    expect(storage.getItem(LEGACY_THEME_KEY)).toBeNull();
  });

  it('exportSnapshot and importSnapshot round-trip', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'Backup Army',
      game: '40k',
      faction: 'Ultramarines',
      crest: 'UM',
      color: '#1c4fa0',
      units: [{ unit: 'Tactical', qty: 5, source: '', state: 'Primed' }],
    }]);

    const json = store.exportSnapshot();
    store.setCollection([]);
    expect(store.getState().collection).toHaveLength(0);

    expect(store.importSnapshot(json)).toBe(true);
    expect(store.getState().collection[0].army).toBe('Backup Army');
  });

  it('importSnapshot rejects invalid JSON', async () => {
    const store = await freshStore();
    const errors = [];
    store.subscribe(r => { if (r === 'load-error') errors.push(r); });

    expect(store.importSnapshot('{not json')).toBe(false);
    expect(errors).toContain('load-error');
  });

  it('notifies save-error when localStorage throws', async () => {
    const store = await freshStore();
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    const errors = [];
    store.subscribe((reason, detail) => {
      if (reason === 'save-error') errors.push(detail);
    });

    store.setPaints([{ name: 'Blue', type: 'Base', swatch: '#00f', qty: 1, brand: '', source: '', notes: '' }]);
    expect(errors[0]).toMatchObject({ message: expect.stringContaining('Storage full') });
  });

  it('load notifies on corrupt data', async () => {
    storage.setItem(STORAGE_KEY, '{bad json');
    const store = await loadStore();
    const errors = [];
    store.subscribe(r => { if (r === 'load-error') errors.push(r); });

    expect(store.load()).toBe(false);
    expect(errors).toContain('load-error');
  });
});
