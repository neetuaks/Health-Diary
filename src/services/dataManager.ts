import { getDB } from '../db/init';
import { deleteAllLocalBackupFiles } from './backup';

// deleteLocalBackup is a required, explicit choice rather than a default —
// the caller (ConfirmDeleteAllModal) asks the user separately whether to
// also remove the on-device backup copy, since keeping it is a legitimate
// "undo" safety net and shouldn't be silently decided either way.
export async function deleteAllData(deleteLocalBackup: boolean) {
  const db = getDB();
  await db.runAsync('DELETE FROM readings;');
  await db.runAsync('DELETE FROM profiles;');
  // The Recovery Key is deliberately never touched here — see
  // deleteAllLocalBackupFiles's comment for why.
  if (deleteLocalBackup) await deleteAllLocalBackupFiles();
}
