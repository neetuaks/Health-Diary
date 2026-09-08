import { Database } from 'expo-sqlite';
import { getDB } from '../db/init';
import { Reading } from '../types';
import { v4 as uuidv4 } from 'uuid';

const db: Database = getDB();

export function fetchReadingsForProfile(profileId: string): Promise<Reading[]> {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql('SELECT * FROM readings WHERE profile_id = ? ORDER BY recorded_at DESC;', [profileId], (_, res) => {
        const rows = res.rows._array.map((r: any) => ({ ...r, values: JSON.parse(r.values) })) as Reading[];
        resolve(rows);
      });
    }, err => reject(err));
  });
}

export function insertReading(r: Omit<Reading, 'id' | 'created_at'> & { id?: string }): Promise<Reading> {
  const id = r.id ?? uuidv4();
  const created_at = new Date().toISOString();
  const reading: Reading = { ...r, id, created_at } as Reading;
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql('INSERT INTO readings (id, profile_id, parameter_type_id, recorded_at, created_at, source, values, notes) VALUES (?,?,?,?,?,?,?,?);',
        [reading.id, reading.profile_id, reading.parameter_type_id, reading.recorded_at, reading.created_at, reading.source, JSON.stringify(reading.values), reading.notes || null]);
    }, err => reject(err), () => resolve(reading));
  });
}

export function deleteReading(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql('DELETE FROM readings WHERE id = ?;', [id]);
    }, err => reject(err), () => resolve());
  });
}

export function updateReading(reading: Reading): Promise<void> {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql('UPDATE readings SET recorded_at = ?, source = ?, values = ?, notes = ? WHERE id = ?;',
        [reading.recorded_at, reading.source, JSON.stringify(reading.values), reading.notes || null, reading.id]);
    }, err => reject(err), () => resolve());
  });
}
