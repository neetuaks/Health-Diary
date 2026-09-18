import { getDB } from '../db/init';
import * as FileSystem from 'expo-file-system/legacy';
import { generateRecoveryKey, deriveKeyFromRecovery, encryptPayload, storeRecoveryKeyOnDevice, getStoredRecoveryKey, decryptPayload } from './crypto';
import { fetchParameterTypes } from './parameterRegistry';
import { writeBackupToConfiguredDestinations, WriteResult, localBackupPath } from './backupDestinations';

const BACKUP_FILENAME = 'healthdiary_backup.json';

export interface CreateBackupResult {
  uri: string;
  destinations: WriteResult;
}

// Returns the created file's uri rather than sharing it directly — creating and
// sharing are two separate user actions (see BackupScreen), so the user gets a
// clear "backup created" confirmation independent of whatever they do in the OS
// share sheet afterward, and a share-step issue can't be mistaken for backup
// creation itself failing. Also writes the same content to the always-on local
// safety copy (see backupDestinations.ts), identical on iOS and Android.
export async function createEncryptedBackup(): Promise<CreateBackupResult> {
  // Generate recovery key if none stored
  let recovery = await getStoredRecoveryKey();
  if (!recovery) {
    recovery = await generateRecoveryKey();
    await storeRecoveryKeyOnDevice(recovery);
  }

  // Build payload
  const db = getDB();
  const profiles = await db.getAllAsync<any>('SELECT * FROM profiles;');
  const ptsRaw = await db.getAllAsync<any>('SELECT * FROM parameter_types;');
  const pts = ptsRaw.map((p: any) => ({ ...p, field_definitions: JSON.parse(p.field_definitions) }));
  const readingsRaw = await db.getAllAsync<any>('SELECT * FROM readings;');
  const readings = readingsRaw.map((r: any) => ({ ...r, vals: JSON.parse(r.vals) }));
  const payloadObj = { profiles, parameter_types: pts, readings };
  const payloadStr = JSON.stringify(payloadObj);
  const payload = Buffer.from(payloadStr, 'utf8');

  const { key, salt } = deriveKeyFromRecovery(recovery);
  const { nonce, box } = encryptPayload(key, payload);

  const container = {
    version: 1,
    salt: Buffer.from(salt).toString('hex'),
    nonce: Buffer.from(nonce).toString('hex'),
    ciphertext: Buffer.from(box).toString('hex')
  };
  // A custom, unrecognized extension like the old ".hdb" made the file appear as
  // an unopenable/unrecognized blob to other apps' pickers (WhatsApp, Drive,
  // Files) — hard to pick back up later even though the content is plain JSON
  // (just an encrypted payload inside it). ".json" is honest about the format and
  // is broadly recognized/previewable everywhere.
  const containerJson = JSON.stringify(container);
  const path = FileSystem.cacheDirectory + BACKUP_FILENAME;
  await FileSystem.writeAsStringAsync(path, containerJson, { encoding: FileSystem.EncodingType.UTF8 });

  // Update last_backup_at for profiles included
  const now = new Date().toISOString();
  for (const p of profiles) {
    await db.runAsync('UPDATE profiles SET last_backup_at = ? WHERE id = ?;', [now, p.id]);
  }

  const destinations = await writeBackupToConfiguredDestinations(containerJson, BACKUP_FILENAME);

  return { uri: path, destinations };
}

// Backs the "restore automatically" path in BackupScreen: if this device
// already made a backup, its content is read straight from the app's own
// storage — no file picker, no need for the user to know or remember where a
// backup file might be. Returns null (not an error) when there's nothing to
// find, e.g. a genuinely new device/install.
export async function readLocalBackupCopy(): Promise<string | null> {
  const path = localBackupPath(BACKUP_FILENAME);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  return FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.UTF8 });
}

export async function localBackupCopyExists(): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(localBackupPath(BACKUP_FILENAME));
  return info.exists;
}

// "Delete My Data (All)" is supposed to mean the data is actually gone — the
// local safety copy and the shareable cache-directory copy are both still
// encrypted data sitting on the device, so deleting only the DB rows while
// leaving those behind isn't a full deletion. The Recovery Key itself is
// deliberately untouched — it's device/install setup, not user data, and
// leaving it means it's still there if the user restores from an external
// backup afterward.
export async function deleteAllLocalBackupFiles(): Promise<void> {
  const paths = [localBackupPath(BACKUP_FILENAME), FileSystem.cacheDirectory + BACKUP_FILENAME];
  for (const path of paths) {
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) await FileSystem.deleteAsync(path, { idempotent: true });
    } catch (e) {
      // best-effort — a leftover file here isn't worth failing the whole delete-all action over
    }
  }
}

export async function peekEncryptedBackup(containerJson: string, recoveryKey?: string) {
  const container = JSON.parse(containerJson);
  const recovery = recoveryKey ?? await getStoredRecoveryKey();
  if (!recovery) throw new Error('No recovery key available');
  const salt = Buffer.from(container.salt, 'hex');
  const nonce = Buffer.from(container.nonce, 'hex');
  const box = Buffer.from(container.ciphertext, 'hex');
  const { key } = deriveKeyFromRecovery(recovery, salt);
  const payload = decryptPayload(key, new Uint8Array(nonce), new Uint8Array(box));
  if (!payload) throw new Error('Decryption failed');
  const decoded = Buffer.from(payload).toString('utf8');
  const obj = JSON.parse(decoded);
  return obj;
}

export async function restoreEncryptedBackupFromFile(containerJson: string, recoveryKey?: string, options?: { replace?: boolean }) {
  const obj = await peekEncryptedBackup(containerJson, recoveryKey);

  const db = getDB();
  if (options?.replace) {
    // delete existing profiles/readings to fully replace
    try { await db.runAsync('DELETE FROM readings;'); } catch (e) {}
    try { await db.runAsync('DELETE FROM profiles;'); } catch (e) {}
  }
  for (const pt of (obj.parameter_types || [])) {
    try {
      await db.runAsync('INSERT OR REPLACE INTO parameter_types (id, display_name, icon, color, is_builtin, field_definitions) VALUES (?,?,?,?,?,?);', [pt.id, pt.display_name, pt.icon, pt.color, pt.is_builtin ?? 0, JSON.stringify(pt.field_definitions)]);
    } catch (e) { /* ignore */ }
  }
  for (const p of (obj.profiles || [])) {
    try {
      await db.runAsync('INSERT OR REPLACE INTO profiles (id, name, date_of_birth, glucose_unit_pref, weight_unit_pref, last_backup_at) VALUES (?,?,?,?,?,?);', [p.id, p.name, p.date_of_birth || null, p.glucose_unit_pref || 'mg/dL', p.weight_unit_pref || 'kg', p.last_backup_at || null]);
    } catch (e) { }
  }
  for (const r of (obj.readings || [])) {
    try {
      await db.runAsync('INSERT OR REPLACE INTO readings (id, profile_id, parameter_type_id, recorded_at, created_at, source, vals, notes) VALUES (?,?,?,?,?,?,?,?);', [r.id, r.profile_id, r.parameter_type_id, r.recorded_at, r.created_at || new Date().toISOString(), r.source || 'manual', JSON.stringify(r.vals || {}), r.notes || null]);
    } catch (e) { }
  }

  return obj;
}
