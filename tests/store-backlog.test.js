import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLocalStorageMock } from './helpers/localStorage.js';
import { STORAGE_KEY, DEFAULT_SETTINGS } from '../js/core/constants.js';

describe('store — backlog (todo: armies & data safety)', () => {
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

  async function freshStore() {
    const store = await import('../js/core/store.js');
    store.setCollection([]);
    store.setPaints([]);
    store.patchSettings(structuredClone(DEFAULT_SETTINGS));
    return store;
  }

  const sampleArmy = (name = 'Test Army') => ({
    army: name,
    game: '40k',
    faction: 'Ultramarines',
    crest: 'UM',
    color: '#1c4fa0',
    units: [{ unit: 'Intercessors', qty: 1, source: 'Combat Patrol', state: 'Unassembled' }],
  });

  it('addArmy, renameArmy, removeArmy', async () => {
    const store = await freshStore();
    expect(store.addArmy(sampleArmy('Alpha'))).toBe(true);
    expect(store.addArmy(sampleArmy('Alpha'))).toBe(false);
    expect(store.renameArmy('Alpha', 'Beta')).toBe(true);
    expect(store.getState().collection[0].army).toBe('Beta');
    store.addArmy(sampleArmy('Other'));
    expect(store.renameArmy('Beta', 'Other')).toBe(false);
    expect(store.removeArmy('Beta')).toBe(true);
    expect(store.removeArmy('Other')).toBe(true);
    expect(store.getState().collection).toHaveLength(0);
  });

  it('duplicateUnit inserts a copy after the original', async () => {
    const store = await freshStore();
    store.setCollection([sampleArmy()]);
    expect(store.duplicateUnit('Test Army', 0)).toBe(true);
    const units = store.getState().collection[0].units;
    expect(units).toHaveLength(2);
    expect(units[0].unit).toBe(units[1].unit);
    expect(units[0]).not.toBe(units[1]);
  });

  it('undoLast restores a removed unit', async () => {
    const store = await freshStore();
    store.setCollection([sampleArmy()]);
    store.removeUnit('Test Army', 0);
    expect(store.getState().collection[0].units).toHaveLength(0);
    expect(store.undoLast()).toBe(true);
    expect(store.getState().collection[0].units[0].unit).toBe('Intercessors');
    expect(store.undoLast()).toBe(false);
  });

  it('updateUnit supports silent persist (no loud notify payload)', async () => {
    const store = await freshStore();
    store.setCollection([sampleArmy()]);
    const payloads = [];
    store.subscribe((reason, detail) => {
      if (reason === 'collection') payloads.push(detail);
    });

    store.updateUnit('Test Army', 0, { notes: 'quiet' }, { silent: true });
    expect(payloads).toEqual([{ silent: true }]);
    expect(store.getState().collection[0].units[0].notes).toBe('quiet');
  });

  it('beginBatch / endBatch notifies once after multiple updates', async () => {
    const store = await freshStore();
    store.setCollection([{
      ...sampleArmy(),
      units: [
        { unit: 'A', qty: 1, source: '', state: 'Unassembled' },
        { unit: 'B', qty: 1, source: '', state: 'Unassembled' },
      ],
    }]);
    const reasons = [];
    store.subscribe(r => reasons.push(r));

    store.beginBatch({ silent: true });
    store.updateUnit('Test Army', 0, { state: 'Primed' }, { silent: true });
    store.updateUnit('Test Army', 1, { state: 'Primed' }, { silent: true });
    store.endBatch('collection');

    expect(reasons.filter(r => r === 'collection')).toHaveLength(1);
    expect(store.getState().collection[0].units.every(u => u.state === 'Primed')).toBe(true);
  });

  it('appendCollection merges units into existing army by name', async () => {
    const store = await freshStore();
    store.setCollection([sampleArmy()]);
    store.appendCollection([{
      ...sampleArmy(),
      units: [{ unit: 'Captain', qty: 1, source: '', state: 'Assembled' }],
    }]);
    expect(store.getState().collection).toHaveLength(1);
    expect(store.getState().collection[0].units).toHaveLength(2);
  });

  it('appendPaints merges duplicate names and sums qty', async () => {
    const store = await freshStore();
    const paint = { name: 'Macragge Blue', type: 'Base', swatch: '#00f', qty: 1, brand: '', source: '', notes: '' };
    store.setPaints([paint]);
    store.appendPaints([{ ...paint, qty: 2 }]);
    expect(store.getState().paints).toHaveLength(1);
    expect(store.getState().paints[0].qty).toBe(3);
  });

  it('clearAllData resets collection, paints, and settings', async () => {
    const store = await freshStore();
    store.setCollection([sampleArmy()]);
    store.setPaints([{ name: 'Blue', type: 'Base', swatch: '#00f', qty: 1, brand: '', source: '', notes: '' }]);
    store.patchSettings({ theme: 'light', collapsedArmies: ['Test Army'] });
    store.clearAllData();
    expect(store.getState().collection).toHaveLength(0);
    expect(store.getState().paints).toHaveLength(0);
    expect(store.getState().settings.theme).toBe(DEFAULT_SETTINGS.theme);
  });

  it('setCollapsedArmies persists in storage silently', async () => {
    const store = await freshStore();
    const reasons = [];
    store.subscribe((r, d) => reasons.push({ r, d }));

    store.setCollapsedArmies(new Set(['Army A', 'Army B']));
    expect(store.getCollapsedArmies()).toEqual(new Set(['Army A', 'Army B']));

    const saved = JSON.parse(storage.getItem(STORAGE_KEY));
    expect(saved.settings.collapsedArmies).toEqual(['Army A', 'Army B']);
    expect(reasons.some(x => x.r === 'settings' && x.d && typeof x.d === 'object' && 'silent' in x.d)).toBe(true);
  });

  it('exportSnapshot includes settings for full backup', async () => {
    const store = await freshStore();
    store.patchSettings({
      theme: 'system',
      pipeline: [{ key: 'Started', hex: '#111' }],
    });
    const snap = JSON.parse(store.exportSnapshot());
    expect(snap.settings.theme).toBe('system');
    expect(snap.settings.pipeline[0].key).toBe('Started');
    expect(snap.exportedAt).toBeTruthy();
  });

  it('inline field patches: unit name, qty, source, spearhead', async () => {
    const store = await freshStore();
    store.setCollection([sampleArmy()]);
    expect(store.updateUnit('Test Army', 0, {
      unit: 'Intercessors (5)',
      qty: 2,
      source: 'Box',
      spearhead: true,
    })).toBe(true);
    const u = store.getState().collection[0].units[0];
    expect(u.unit).toBe('Intercessors (5)');
    expect(u.qty).toBe(2);
    expect(u.source).toBe('Box');
    expect(u.spearhead).toBe(true);
  });
});
