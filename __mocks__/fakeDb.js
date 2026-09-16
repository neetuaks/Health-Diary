// Minimal stateful in-memory stand-in for the real SQLite db, matching the
// exact column names used by src/db/init.ts, so tests exercise the same
// field names (e.g. `vals`, not `values`) as production code.
let profiles = [];
let parameterTypes = [];
let readings = [];

function reset() {
  profiles = [];
  parameterTypes = [];
  readings = [];
}

const db = {
  runAsync: async (sql, params = []) => {
    if (sql.startsWith('DELETE FROM readings WHERE id')) {
      const [id] = params;
      readings = readings.filter((r) => r.id !== id);
      return;
    }
    if (sql.startsWith('DELETE FROM readings')) { readings = []; return; }
    if (sql.startsWith('DELETE FROM profiles')) { profiles = []; return; }
    if (sql.startsWith('UPDATE profiles SET last_backup_at')) {
      const [last_backup_at, id] = params;
      const p = profiles.find((p) => p.id === id);
      if (p) p.last_backup_at = last_backup_at;
      return;
    }
    if (sql.startsWith('INSERT OR REPLACE INTO parameter_types')) {
      const [id, display_name, icon, color, is_builtin, field_definitions] = params;
      parameterTypes = parameterTypes.filter((p) => p.id !== id);
      parameterTypes.push({ id, display_name, icon, color, is_builtin, field_definitions });
      return;
    }
    if (sql.startsWith('INSERT OR REPLACE INTO profiles')) {
      const [id, name, date_of_birth, glucose_unit_pref, weight_unit_pref, last_backup_at] = params;
      profiles = profiles.filter((p) => p.id !== id);
      profiles.push({ id, name, date_of_birth, glucose_unit_pref, weight_unit_pref, last_backup_at });
      return;
    }
    if (sql.startsWith('INSERT OR REPLACE INTO readings') || sql.startsWith('INSERT INTO readings')) {
      const [id, profile_id, parameter_type_id, recorded_at, created_at, source, vals, notes] = params;
      readings = readings.filter((r) => r.id !== id);
      readings.push({ id, profile_id, parameter_type_id, recorded_at, created_at, source, vals, notes });
      return;
    }
    if (sql.startsWith('UPDATE readings SET')) {
      const [recorded_at, source, vals, notes, id] = params;
      const r = readings.find((r) => r.id === id);
      if (r) { r.recorded_at = recorded_at; r.source = source; r.vals = vals; r.notes = notes; }
      return;
    }
    throw new Error('Unhandled runAsync SQL in fakeDb: ' + sql);
  },
  getAllAsync: async (sql) => {
    if (sql.startsWith('SELECT * FROM profiles')) return profiles;
    if (sql.startsWith('SELECT * FROM parameter_types')) return parameterTypes;
    if (sql.startsWith('SELECT * FROM readings')) return readings;
    throw new Error('Unhandled getAllAsync SQL in fakeDb: ' + sql);
  },
  getFirstAsync: async () => null,
  execAsync: async () => {},
  _seedProfiles: (rows) => { profiles = rows; },
  _seedReadings: (rows) => { readings = rows; },
  _seedParameterTypes: (rows) => { parameterTypes = rows; },
  _reset: reset
};

module.exports = { getDB: () => db, __fakeDb: db };
