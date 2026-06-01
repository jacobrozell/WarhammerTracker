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

  it('migrates legacy theme key when settings theme is unset', async () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: APP_VERSION,
      collection: [],
      paints: [],
      settings: { theme: '', pipeline: null, factionPresets: null },
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

  it('moveUnit transfers between armies', async () => {
    const store = await freshStore();
    store.setCollection([
      {
        army: 'A', game: '40k', faction: 'X', crest: 'A', color: '#888',
        units: [{ unit: 'Unit', qty: 1, source: '', state: 'Unassembled' }],
      },
      {
        army: 'B', game: '40k', faction: 'X', crest: 'B', color: '#888',
        units: [],
      },
    ]);
    expect(store.moveUnit('A', 0, 'B')).toBe(true);
    expect(store.getState().collection[0].units).toHaveLength(0);
    expect(store.getState().collection[1].units[0].unit).toBe('Unit');
  });

  it('mergeArmyDuplicates combines matching rows', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'A', game: '40k', faction: 'X', crest: 'A', color: '#888',
      units: [
        { unit: 'Clanrats (5)', qty: 1, source: 'Box', state: 'Based' },
        { unit: 'Clanrats (5)', qty: 2, source: 'Box', state: 'Based' },
      ],
    }]);
    expect(store.mergeArmyDuplicates('A')).toBe(1);
    expect(store.getState().collection[0].units).toHaveLength(1);
    expect(store.getState().collection[0].units[0].qty).toBe(3);
  });

  it('paint CRUD operations', async () => {
    const store = await freshStore();
    expect(store.addPaint({ name: 'Red', type: 'Base', swatch: '#f00', qty: 1, brand: '', source: '', notes: '' })).toBe(true);
    expect(store.addPaint({ name: 'Red', type: 'Base', swatch: '#f00', qty: 1, brand: '', source: '', notes: '' })).toBe(false);
    expect(store.updatePaint('Red', { qty: 2 })).toBe(true);
    expect(store.getState().paints[0].qty).toBe(2);
    expect(store.removePaint('Red')).toBe(true);
    expect(store.getState().paints).toHaveLength(0);
  });

  it('patchSettings persists filter prefs silently', async () => {
    const store = await freshStore();
    const reasons = [];
    store.subscribe((r, d) => reasons.push({ r, d }));
    store.patchSettings({ armySort: 'name', gameFilter: 'AoS' }, { silent: true });
    expect(store.getState().settings.armySort).toBe('name');
    expect(reasons[reasons.length - 1]?.d).toEqual({ silent: true });
  });

  it('undo restores unit state changes', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'A', game: '40k', faction: 'X', crest: 'A', color: '#888',
      units: [{ unit: 'U', qty: 1, source: '', state: 'Unassembled' }],
    }]);
    store.updateUnit('A', 0, { state: 'Primed' });
    expect(store.getState().collection[0].units[0].state).toBe('Primed');
    expect(store.undoLast()).toBe(true);
    expect(store.getState().collection[0].units[0].state).toBe('Unassembled');
  });

  it('setArmyPipeline and getArmyPipeline', async () => {
    const store = await freshStore();
    const army = { army: 'T', game: '40k', faction: 'X', crest: 'T', color: '#888', units: [] };
    store.setCollection([army]);
    const custom = [{ key: 'Built', hex: '#fff' }, { key: 'Done', hex: '#0f0' }];
    expect(store.setArmyPipeline('T', custom)).toBe(true);
    expect(store.getArmyPipeline(store.getState().collection[0])).toHaveLength(2);
  });

  it('recordBackup sets lastBackupAt', async () => {
    const store = await freshStore();
    store.recordBackup();
    expect(store.getState().settings.lastBackupAt).toBeTruthy();
  });

  it('undo restores removed unit', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'A', game: '40k', faction: 'X', crest: 'A', color: '#888',
      units: [
        { unit: 'Keep', qty: 1, source: '', state: 'Unassembled' },
        { unit: 'Gone', qty: 1, source: '', state: 'Unassembled' },
      ],
    }]);
    store.removeUnit('A', 1);
    expect(store.getState().collection[0].units).toHaveLength(1);
    expect(store.undoLast()).toBe(true);
    expect(store.getState().collection[0].units[1].unit).toBe('Gone');
  });

  it('undo restores removed army', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'Deleted', game: '40k', faction: 'X', crest: 'D', color: '#888', units: [],
    }]);
    store.removeArmy('Deleted');
    expect(store.getState().collection).toHaveLength(0);
    expect(store.undoLast()).toBe(true);
    expect(store.getState().collection[0].army).toBe('Deleted');
  });

  it('undo batch-states restores bulk advance', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'A', game: '40k', faction: 'X', crest: 'A', color: '#888',
      units: [
        { unit: 'U1', qty: 1, source: '', state: 'Unassembled' },
        { unit: 'U2', qty: 1, source: '', state: 'Unassembled' },
      ],
    }]);
    store.pushUndoBatchStates([
      { armyName: 'A', index: 0, state: 'Unassembled' },
      { armyName: 'A', index: 1, state: 'Unassembled' },
    ]);
    store.updateUnit('A', 0, { state: 'Primed' }, { skipUndo: true });
    store.updateUnit('A', 1, { state: 'Primed' }, { skipUndo: true });
    expect(store.undoLast()).toBe(true);
    expect(store.getState().collection[0].units.map(u => u.state)).toEqual(['Unassembled', 'Unassembled']);
  });

  it('appendCollection merges units into existing army', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'A', game: '40k', faction: 'X', crest: 'A', color: '#888',
      units: [{ unit: 'U1', qty: 1, source: '', state: 'Unassembled' }],
    }]);
    store.appendCollection([{
      army: 'A', game: '40k', faction: 'X', crest: 'A', color: '#888',
      units: [{ unit: 'U2', qty: 1, source: '', state: 'Primed' }],
    }]);
    expect(store.getState().collection).toHaveLength(1);
    expect(store.getState().collection[0].units).toHaveLength(2);
  });

  it('appendPaints merges quantities case-insensitively', async () => {
    const store = await freshStore();
    store.setPaints([{ name: 'Blue', type: 'Base', swatch: '#00f', qty: 1, brand: '', source: '', notes: '' }]);
    store.appendPaints([{ name: 'blue', type: 'Base', swatch: '#00f', qty: 2, brand: '', source: '', notes: '' }]);
    expect(store.getState().paints).toHaveLength(1);
    expect(store.getState().paints[0].qty).toBe(3);
  });

  it('renameArmy updates army key and rejects duplicate names', async () => {
    const store = await freshStore();
    store.setCollection([
      { army: 'Old', game: '40k', faction: 'X', crest: 'O', color: '#888', units: [] },
      { army: 'Taken', game: '40k', faction: 'X', crest: 'T', color: '#888', units: [] },
    ]);
    expect(store.renameArmy('Old', 'New')).toBe(true);
    expect(store.getState().collection[0].army).toBe('New');
    expect(store.renameArmy('New', 'Taken')).toBe(false);
  });

  it('duplicateUnit inserts a copy after the source', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'A', game: '40k', faction: 'X', crest: 'A', color: '#888',
      units: [{ unit: 'Squad', qty: 1, source: '', state: 'Primed', notes: 'x' }],
    }]);
    expect(store.duplicateUnit('A', 0)).toBe(true);
    const units = store.getState().collection[0].units;
    expect(units).toHaveLength(2);
    expect(units[1].unit).toBe('Squad');
    expect(units[1]).not.toBe(units[0]);
  });

  it('previewBackup validates without mutating state', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'A', game: '40k', faction: 'X', crest: 'A', color: '#888',
      units: [{ unit: 'U', qty: 1, source: '', state: 'Unassembled' }],
    }]);
    const json = store.exportSnapshot();
    store.setCollection([]);
    const preview = store.previewBackup(json);
    expect(preview.ok).toBe(true);
    if (preview.ok) expect(preview.preview).toContain('1 armies');
    expect(store.getState().collection).toHaveLength(0);
  });

  it('beginBatch defers persist until endBatch', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'A', game: '40k', faction: 'X', crest: 'A', color: '#888',
      units: [{ unit: 'U', qty: 1, source: '', state: 'Unassembled' }],
    }]);
    const before = storage.getItem(STORAGE_KEY);
    store.beginBatch({ silent: true });
    store.updateUnit('A', 0, { state: 'Primed' }, { silent: true });
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
    store.endBatch('collection');
    expect(JSON.parse(storage.getItem(STORAGE_KEY)).collection[0].units[0].state).toBe('Primed');
  });

  it('applyFactionPresets refreshes army colours', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'Test', game: '40k', faction: 'Ultramarines', crest: 'OLD', color: '#000000',
      units: [],
    }]);
    store.applyFactionPresets(null);
    expect(store.getState().collection[0].crest).toBe('UM');
    expect(store.getState().collection[0].color).toBe('#1c4fa0');
  });

  it('clearAllData resets collection and paints', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'A', game: '40k', faction: 'X', crest: 'A', color: '#888',
      units: [{ unit: 'U', qty: 1, source: '', state: 'Unassembled' }],
    }]);
    store.setPaints([{ name: 'Red', type: 'Base', swatch: '#f00', qty: 1, brand: '', source: '', notes: '' }]);
    store.clearAllData();
    expect(store.getState().collection).toHaveLength(0);
    expect(store.getState().paints).toHaveLength(0);
  });

  it('setAllUnitsState updates every unit in an army', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'A', game: '40k', faction: 'X', crest: 'A', color: '#888',
      units: [
        { unit: 'U1', qty: 1, source: '', state: 'Unassembled' },
        { unit: 'U2', qty: 1, source: '', state: 'Unassembled' },
      ],
    }]);
    expect(store.setAllUnitsState('A', 'Primed')).toBe(true);
    expect(store.getState().collection[0].units.every(u => u.state === 'Primed')).toBe(true);
  });

  it('squad member enable, update, and disable', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'A', game: '40k', faction: 'X', crest: 'A', color: '#888',
      units: [{ unit: 'Terminators (2)', qty: 1, source: '', state: 'Magnetising' }],
    }]);
    expect(store.enableSquadMembers('A', 0)).toBe(true);
    expect(store.getState().collection[0].units[0].members).toHaveLength(2);
    expect(store.updateMember('A', 0, 1, { state: 'Primed', notes: 'lead' })).toBe(true);
    expect(store.getState().collection[0].units[0].members[1].state).toBe('Primed');
    expect(store.disableSquadMembers('A', 0)).toBe(true);
    expect(store.getState().collection[0].units[0].members).toBeUndefined();
  });

  it('enableSquadMembers fails for single-model units', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'A', game: '40k', faction: 'X', crest: 'A', color: '#888',
      units: [{ unit: 'Captain', qty: 1, source: '', state: 'Unassembled' }],
    }]);
    expect(store.enableSquadMembers('A', 0)).toBe(false);
  });

  it('addArmy rejects duplicate names', async () => {
    const store = await freshStore();
    const army = { army: 'Dup', game: '40k', faction: 'X', crest: 'D', color: '#888', units: [] };
    expect(store.addArmy(army)).toBe(true);
    expect(store.addArmy({ ...army })).toBe(false);
  });

  it('setCollapsedArmies round-trips through settings', async () => {
    const store = await freshStore();
    store.setCollapsedArmies(new Set(['Alpha', 'Beta']));
    expect(store.getCollapsedArmies()).toEqual(new Set(['Alpha', 'Beta']));
  });

  it('canUndo reflects undo stack', async () => {
    const store = await freshStore();
    expect(store.canUndo()).toBe(false);
    store.setCollection([{
      army: 'A', game: '40k', faction: 'X', crest: 'A', color: '#888',
      units: [{ unit: 'U', qty: 1, source: '', state: 'Unassembled' }],
    }]);
    store.updateUnit('A', 0, { state: 'Primed' });
    expect(store.canUndo()).toBe(true);
  });

  it('updatePaint rejects rename to existing name', async () => {
    const store = await freshStore();
    store.setPaints([
      { name: 'Red', type: 'Base', swatch: '#f00', qty: 1, brand: '', source: '', notes: '' },
      { name: 'Blue', type: 'Base', swatch: '#00f', qty: 1, brand: '', source: '', notes: '' },
    ]);
    expect(store.updatePaint('Red', { name: 'Blue' })).toBe(false);
  });

  it('reapplyArmyFactionDefaults syncs crest and color', async () => {
    const store = await freshStore();
    store.setCollection([{
      army: 'GK', game: '40k', faction: 'Grey Knights', crest: 'OLD', color: '#000',
      units: [],
    }]);
    expect(store.reapplyArmyFactionDefaults('GK')).toBe(true);
    expect(store.getState().collection[0].crest).toBe('GK');
  });
});
