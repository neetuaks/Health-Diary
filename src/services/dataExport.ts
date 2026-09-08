import { getDB } from '../db/init';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function exportAllAsJSON() {
  const db = getDB();
  db.transaction(tx => {
    tx.executeSql('SELECT * FROM profiles;', [], async (_, profRes) => {
      const profiles = profRes.rows._array;
      tx.executeSql('SELECT * FROM parameter_types;', [], async (_, ptRes) => {
        const pts = ptRes.rows._array.map((p: any) => ({ ...p, field_definitions: JSON.parse(p.field_definitions) }));
        tx.executeSql('SELECT * FROM readings;', [], async (_, rRes) => {
          const readings = rRes.rows._array.map((r: any) => ({ ...r, values: JSON.parse(r.values) }));
          const payload = { profiles, parameter_types: pts, readings };
          const path = FileSystem.cacheDirectory + 'healthdiary_export.json';
          await FileSystem.writeAsStringAsync(path, JSON.stringify(payload, null, 2), { encoding: FileSystem.EncodingType.UTF8 });
          await Sharing.shareAsync(path);
        });
      });
    });
  });
}

export async function exportAllAsCSV() {
  const db = getDB();
  db.transaction(tx => {
    tx.executeSql('SELECT * FROM readings;', [], async (_, rRes) => {
      const rows = rRes.rows._array.map((r: any) => ({ ...r, values: JSON.parse(r.values) }));
      const header = ['id,profile_id,parameter_type_id,recorded_at,created_at,source,values,notes'];
      const lines = rows.map((r: any) => {
        return [r.id, r.profile_id, r.parameter_type_id, r.recorded_at, r.created_at, r.source, JSON.stringify(r.values), r.notes || ''].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',');
      });
      const csv = header.concat(lines).join('\n');
      const path = FileSystem.cacheDirectory + 'healthdiary_export.csv';
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path);
    });
  });
}
