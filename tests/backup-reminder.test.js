import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLocalStorageMock } from './helpers/localStorage.js';
import { DEFAULT_SETTINGS } from '../js/core/constants.js';

const toast = vi.fn();
vi.mock('../js/ui/toast.js', () => ({ toast }));

function createSessionStorageMock() {
  return createLocalStorageMock();
}

describe('checkBackupReminder', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    vi.stubGlobal('sessionStorage', createSessionStorageMock());
    vi.resetModules();
    toast.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function load() {
    const store = await import('../js/core/store.js');
    const { checkBackupReminder } = await import('../js/ui/backup-reminder.js');
    return { store, checkBackupReminder };
  }

  it('does nothing when collection is empty', async () => {
    const { store, checkBackupReminder } = await load();
    store.setCollection([]);
    store.setPaints([]);
    checkBackupReminder();
    expect(toast).not.toHaveBeenCalled();
  });

  it('does nothing when a recent backup was recorded', async () => {
    const { store, checkBackupReminder } = await load();
    store.setCollection([{
      army: 'A', game: '40k', faction: 'X', crest: 'A', color: '#888',
      units: [{ unit: 'U', qty: 1, source: '', state: 'Unassembled' }],
    }]);
    store.patchSettings({
      ...DEFAULT_SETTINGS,
      lastBackupAt: new Date().toISOString(),
    }, { silent: true });
    checkBackupReminder();
    expect(toast).not.toHaveBeenCalled();
  });

  it('nudges when data exists and backup is older than 14 days', async () => {
    const { store, checkBackupReminder } = await load();
    store.setCollection([{
      army: 'A', game: '40k', faction: 'X', crest: 'A', color: '#888',
      units: [{ unit: 'U', qty: 1, source: '', state: 'Unassembled' }],
    }]);
    const old = new Date(Date.now() - 20 * 86400000).toISOString();
    store.patchSettings({ ...DEFAULT_SETTINGS, lastBackupAt: old }, { silent: true });
    checkBackupReminder();
    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining('Full backup'),
      7000,
    );
  });

  it('nudges when data exists and no backup was ever recorded', async () => {
    const { store, checkBackupReminder } = await load();
    store.setPaints([{ name: 'Blue', type: 'Base', swatch: '#00f', qty: 1, brand: '', source: '', notes: '' }]);
    checkBackupReminder();
    expect(toast).toHaveBeenCalled();
  });

  it('shows at most once per session', async () => {
    const { store, checkBackupReminder } = await load();
    store.setPaints([{ name: 'Blue', type: 'Base', swatch: '#00f', qty: 1, brand: '', source: '', notes: '' }]);
    checkBackupReminder();
    checkBackupReminder();
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
