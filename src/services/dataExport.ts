import { getDB } from '../db/init';
import * as FileSystem from 'expo-file-system/legacy';
import { shareFile } from './share';
import { filterByHistoryWindow } from './utils';
import { APP_NAME } from '../config/legal';

// `exportWindowDays` is the caller's current tier limit (PAYWALL-SPEC §2/§4.4)
// — null on Pro/Premium (full history), 7 on Free. Older rows are excluded
// from the exported file only; nothing is ever deleted, and Backup (a
// separate, always-full flow — see backup.ts) never applies this window.
export async function exportAllAsJSON(exportWindowDays: number | null = null) {
  const db = getDB();
  const profiles = await db.getAllAsync<any>('SELECT * FROM profiles;');
  const ptsRaw = await db.getAllAsync<any>('SELECT * FROM parameter_types;');
  const pts = ptsRaw.map((p: any) => ({ ...p, field_definitions: JSON.parse(p.field_definitions) }));
  const readingsRaw = await db.getAllAsync<any>('SELECT * FROM readings;');
  const readings = filterByHistoryWindow(readingsRaw.map((r: any) => ({ ...r, vals: JSON.parse(r.vals) })), exportWindowDays);
  const payload = { profiles, parameter_types: pts, readings };
  const path = FileSystem.cacheDirectory + 'healthdiary_export.json';
  await FileSystem.writeAsStringAsync(path, JSON.stringify(payload, null, 2), { encoding: FileSystem.EncodingType.UTF8 });
  await shareFile(path, `${APP_NAME} Export (JSON)`, 'application/json');
}

export async function exportAllAsCSV(exportWindowDays: number | null = null) {
  const db = getDB();
  const rowsRaw = await db.getAllAsync<any>('SELECT * FROM readings;');
  const rows = filterByHistoryWindow(rowsRaw, exportWindowDays);
  const header = ['id,profile_id,parameter_type_id,recorded_at,created_at,source,vals,notes'];
  const lines = rows.map((r: any) => {
    return [r.id, r.profile_id, r.parameter_type_id, r.recorded_at, r.created_at, r.source, r.vals, r.notes || ''].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',');
  });
  const csv = header.concat(lines).join('\n');
  const path = FileSystem.cacheDirectory + 'healthdiary_export.csv';
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await shareFile(path, `${APP_NAME} Export (CSV)`, 'text/csv');
}
