import { getDB } from '../db/init';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { generateRecoveryKey, deriveKeyFromRecovery, encryptPayload, storeRecoveryKeyOnDevice, getStoredRecoveryKey, decryptPayload } from './crypto';
import { fetchParameterTypes } from './parameterRegistry';

export async function createEncryptedBackup(allProfiles = true) {
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
  const readings = readingsRaw.map((r: any) => ({ ...r, values: JSON.parse(r.values) }));
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
  const path = FileSystem.cacheDirectory + 'healthdiary_backup.hdb';
  await FileSystem.writeAsStringAsync(path, JSON.stringify(container), { encoding: FileSystem.EncodingType.UTF8 });

  // Update last_backup_at for profiles included
  const now = new Date().toISOString();
  for (const p of profiles) {
    await db.runAsync('UPDATE profiles SET last_backup_at = ? WHERE id = ?;', [now, p.id]);
  }

  await Sharing.shareAsync(path);
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
      await db.runAsync('INSERT OR REPLACE INTO readings (id, profile_id, parameter_type_id, recorded_at, created_at, source, values, notes) VALUES (?,?,?,?,?,?,?,?);', [r.id, r.profile_id, r.parameter_type_id, r.recorded_at, r.created_at || new Date().toISOString(), r.source || 'manual', JSON.stringify(r.values || {}), r.notes || null]);
    } catch (e) { }
  }

  return obj;
}
