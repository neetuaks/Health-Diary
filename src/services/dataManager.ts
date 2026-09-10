import { getDB } from '../db/init';
import * as FileSystem from 'expo-file-system';

export async function deleteAllData() {
  const db = getDB();
  await db.runAsync('DELETE FROM readings;');
  await db.runAsync('DELETE FROM profiles;');
}
