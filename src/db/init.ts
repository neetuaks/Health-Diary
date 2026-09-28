import * as SQLite from 'expo-sqlite';
import { seedParameterTypes } from './seed';

const db = SQLite.openDatabaseSync('healthdiary.db');

// SQLite has no "ADD COLUMN IF NOT EXISTS" — the try/catch is how every
// column added after the original CREATE TABLE IF NOT EXISTS gets backfilled
// onto an install that already has the table (a fresh install's CREATE TABLE
// above already includes it, so this becomes a harmless "duplicate column"
// error there).
function addColumnIfMissing(table: string, columnDef: string) {
  try {
    db.execSync(`ALTER TABLE ${table} ADD COLUMN ${columnDef};`);
  } catch {
    // already exists
  }
}

export async function initDB() {
  try {
    db.execSync(`CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date_of_birth TEXT,
      glucose_unit_pref TEXT DEFAULT 'mg/dL',
      weight_unit_pref TEXT DEFAULT 'kg',
      last_backup_at TEXT,
      locked_at TEXT
    );`);

    db.execSync(`CREATE TABLE IF NOT EXISTS parameter_types (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      is_builtin INTEGER DEFAULT 1,
      field_definitions TEXT NOT NULL,
      locked_at TEXT
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

    // PDF report history (PAYWALL-SPEC §6, Pro/Premium only) — generated PDFs
    // stay in the app document directory; this is the local index of them
    // (id, generatedAt, profileIds, dateRange, filePath, type). Free never
    // writes a PDF file at all, so it never has rows here.
    db.execSync(`CREATE TABLE IF NOT EXISTS pdf_reports (
      id TEXT PRIMARY KEY,
      generated_at TEXT NOT NULL,
      profile_ids TEXT NOT NULL,
      date_range TEXT,
      file_path TEXT NOT NULL,
      type TEXT NOT NULL
    );`);

    addColumnIfMissing('profiles', 'locked_at TEXT');
    addColumnIfMissing('parameter_types', 'locked_at TEXT');

    seedParameterTypes(db);
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
