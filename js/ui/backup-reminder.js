import { getState } from '../core/store.js';
import { toast } from './toast.js';

const REMIND_DAYS = 14;
const SESSION_KEY = 'musterRoll.backupReminded';

/** Nudge if collection has data and no recent Full backup. */
export function checkBackupReminder() {
  if (sessionStorage.getItem(SESSION_KEY)) return;
  const { collection, paints, settings } = getState();
  if (!collection.length && !paints.length) return;
  const last = settings.lastBackupAt ? new Date(settings.lastBackupAt).getTime() : 0;
  const days = last ? (Date.now() - last) / 86400000 : Infinity;
  if (days < REMIND_DAYS) return;
  sessionStorage.setItem(SESSION_KEY, '1');
  toast('Tip: export a Full backup — CSV exports do not include pipeline or theme', 7000);
}
