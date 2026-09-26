import { SQLiteDatabase } from 'expo-sqlite';
import { getDB } from '../db/init';
import { Reading } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { matchesDateRange } from './utils';

const db: SQLiteDatabase = getDB();

export async function fetchReadingsForProfile(profileId: string): Promise<Reading[]> {
  const rows = await db.getAllAsync<any>('SELECT * FROM readings WHERE profile_id = ? ORDER BY recorded_at DESC;', [profileId]);
  return rows.map((r: any) => ({ ...r, vals: JSON.parse(r.vals) })) as Reading[];
}

export async function insertReading(r: Omit<Reading, 'id' | 'created_at'> & { id?: string }): Promise<Reading> {
  const id = r.id ?? uuidv4();
  const created_at = new Date().toISOString();
  const reading: Reading = { ...r, id, created_at } as Reading;
  
  await db.runAsync(
    'INSERT INTO readings (id, profile_id, parameter_type_id, recorded_at, created_at, source, vals, notes) VALUES (?,?,?,?,?,?,?,?);',
    [reading.id, reading.profile_id, reading.parameter_type_id, reading.recorded_at, reading.created_at, reading.source, JSON.stringify(reading.vals), reading.notes || null]
  );
  return reading;
}

export async function deleteReading(id: string): Promise<void> {
  await db.runAsync('DELETE FROM readings WHERE id = ?;', [id]);
}

export async function updateReading(reading: Reading): Promise<void> {
  await db.runAsync(
    'UPDATE readings SET recorded_at = ?, source = ?, vals = ?, notes = ? WHERE id = ?;',
    [reading.recorded_at, reading.source, JSON.stringify(reading.vals), reading.notes || null, reading.id]
  );
}

export type BulkDeleteFilter = { parameterTypeId?: string | null; from?: Date | null; to?: Date | null };

// Filters/loops in JS rather than a dynamic SQL WHERE clause — at personal-health-diary
// scale (hundreds, not millions, of rows) this is simpler and easier to get right, and
// reuses fetchReadingsForProfile's existing profile scoping instead of duplicating it.
export async function fetchReadingsMatchingFilter(profileId: string, filter: BulkDeleteFilter): Promise<Reading[]> {
  const all = await fetchReadingsForProfile(profileId);
  return all.filter(
    r =>
      (!filter.parameterTypeId || r.parameter_type_id === filter.parameterTypeId) &&
      matchesDateRange(r.recorded_at, filter.from ?? null, filter.to ?? null)
  );
}

export async function deleteReadingsMatchingFilter(profileId: string, filter: BulkDeleteFilter): Promise<number> {
  const matches = await fetchReadingsMatchingFilter(profileId, filter);
  for (const r of matches) await deleteReading(r.id);
  return matches.length;
}
