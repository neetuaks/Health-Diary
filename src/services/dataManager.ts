import { getDB } from '../db/init';
import * as FileSystem from 'expo-file-system';

export async function deleteAllData() {
  const db = getDB();
  return new Promise<void>((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql('DELETE FROM readings;');
      tx.executeSql('DELETE FROM profiles;');
    }, err => reject(err), () => resolve());
  });
}
