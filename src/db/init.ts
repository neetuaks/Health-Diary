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

    // A row means "this custom parameter type is enabled for this profile". Built-in
    // types never get rows here and are always included regardless — see
    // src/services/profileParameterTypes.ts.
    db.execSync(`CREATE TABLE IF NOT EXISTS profile_parameter_types (
      profile_id TEXT NOT NULL,
      parameter_type_id TEXT NOT NULL,
      PRIMARY KEY (profile_id, parameter_type_id)
    );`);

    addColumnIfMissing('profiles', 'locked_at TEXT');
    addColumnIfMissing('parameter_types', 'locked_at TEXT');
    addColumnIfMissing('parameter_types', 'created_at TEXT');

    seedParameterTypes(db);

    // Custom types created before created_at existed have no value for it yet —
    // backfill using rowid order (their existing relative add-order) so they don't
    // all collapse to "same timestamp" and sort arbitrarily. BP/Glucose always get
    // an explicit created_at from seedParameterTypes above, so this only ever
    // touches pre-existing custom types.
    db.execSync(
      `UPDATE parameter_types SET created_at = printf('1970-01-01T00:00:%05d.000Z', rowid) WHERE created_at IS NULL;`
    );
    // Dynamic import, not a static one: profileParameterTypes.ts imports getDB from this
    // file, so a static import here would be a require cycle. A cycle is order-dependent —
    // whichever module Metro loads first can end up calling this function while the other
    // module's own top-level consts (e.g. profileParameterTypes.ts's MIGRATION_FLAG_KEY)
    // haven't been assigned yet, which is exactly how this broke before (SecureStore got
    // called with an undefined key). Dynamic import always resolves on a later microtask,
    // after the whole synchronous require graph has finished, so both modules are
    // guaranteed fully initialized by the time this runs.
    const { backfillLegacyCustomParameterTypeScoping } = await import('../services/profileParameterTypes');
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
