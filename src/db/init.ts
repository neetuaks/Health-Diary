import * as SQLite from 'expo-sqlite';
import { seedParameterTypes } from './seed';

const db = SQLite.openDatabase('healthdiary.db');

export function initDB() {
  db.transaction(tx => {
    tx.executeSql(`CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date_of_birth TEXT,
      glucose_unit_pref TEXT DEFAULT 'mg/dL',
      weight_unit_pref TEXT DEFAULT 'kg',
      last_backup_at TEXT
    );`);

    tx.executeSql(`CREATE TABLE IF NOT EXISTS parameter_types (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      is_builtin INTEGER DEFAULT 1,
      field_definitions TEXT NOT NULL
    );`);

    tx.executeSql(`CREATE TABLE IF NOT EXISTS readings (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      parameter_type_id TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      source TEXT NOT NULL,
      values TEXT NOT NULL,
      notes TEXT
    );`);
  }, err => {
    console.error('DB init error', err);
  }, () => {
    seedParameterTypes(db);
  });
}

export function getDB() {
  return db;
}
