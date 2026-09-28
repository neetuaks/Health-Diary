import * as SQLite from 'expo-sqlite';
import { seedParameterTypes } from './seed';
import { backfillLegacyCustomParameterTypeScoping } from '../services/profileParameterTypes';

const db = SQLite.openDatabaseSync('healthdiary.db');

export async function initDB() {
  try {
    db.execSync(`CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date_of_birth TEXT,
      glucose_unit_pref TEXT DEFAULT 'mg/dL',
      weight_unit_pref TEXT DEFAULT 'kg',
      last_backup_at TEXT
    );`);

    db.execSync(`CREATE TABLE IF NOT EXISTS parameter_types (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      is_builtin INTEGER DEFAULT 1,
      field_definitions TEXT NOT NULL
    );`);

    db.execSync(`CREATE TABLE IF NOT EXISTS readings (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      parameter_type_id TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      source TEXT NOT NULL,
      vals TEXT NOT NULL,
      notes TEXT
    );`);

    // A row means "this custom parameter type is enabled for this profile". Built-in
    // types never get rows here and are always included regardless — see
    // src/services/profileParameterTypes.ts.
    db.execSync(`CREATE TABLE IF NOT EXISTS profile_parameter_types (
      profile_id TEXT NOT NULL,
      parameter_type_id TEXT NOT NULL,
      PRIMARY KEY (profile_id, parameter_type_id)
    );`);

    seedParameterTypes(db);
    await backfillLegacyCustomParameterTypeScoping();
  } catch (err) {
    console.error('DB init error', err);
  }
}

export function getDB() {
  return db;
}

// Run once at module load so tables exist before any consumer queries them,
// regardless of React effect ordering.
initDB();
