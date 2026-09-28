// Minimal stateful in-memory stand-in for the real SQLite db, matching the
// exact column names used by src/db/init.ts, so tests exercise the same
// field names (e.g. `vals`, not `values`) as production code.
let profiles = [];
let parameterTypes = [];
let readings = [];
let profileParameterTypes = [];

function reset() {
  profiles = [];
  parameterTypes = [];
  readings = [];
  profileParameterTypes = [];
}

const db = {
  runAsync: async (sql, params = []) => {
    if (sql.startsWith('DELETE FROM readings WHERE id')) {
      const [id] = params;
      readings = readings.filter((r) => r.id !== id);
      return;
    }
    if (sql.startsWith('DELETE FROM readings')) { readings = []; return; }
    if (sql.startsWith('DELETE FROM profile_parameter_types WHERE profile_id = ? AND parameter_type_id = ?')) {
      const [profile_id, parameter_type_id] = params;
      profileParameterTypes = profileParameterTypes.filter((r) => !(r.profile_id === profile_id && r.parameter_type_id === parameter_type_id));
      return;
    }
    if (sql.startsWith('DELETE FROM profile_parameter_types WHERE parameter_type_id')) {
      const [parameter_type_id] = params;
      profileParameterTypes = profileParameterTypes.filter((r) => r.parameter_type_id !== parameter_type_id);
      return;
    }
    if (sql.startsWith('DELETE FROM profile_parameter_types WHERE profile_id')) {
      const [profile_id] = params;
      profileParameterTypes = profileParameterTypes.filter((r) => r.profile_id !== profile_id);
      return;
    }
    if (sql.startsWith('DELETE FROM profile_parameter_types')) { profileParameterTypes = []; return; }
    if (sql.startsWith('DELETE FROM profiles')) { profiles = []; return; }
    if (sql.startsWith('UPDATE profiles SET last_backup_at')) {
      const [last_backup_at, id] = params;
      const p = profiles.find((p) => p.id === id);
      if (p) p.last_backup_at = last_backup_at;
      return;
    }
    if (sql.startsWith('INSERT OR IGNORE INTO profile_parameter_types') && sql.includes('SELECT p.id, pt.id')) {
      // Backfill migration: every profile x every non-builtin parameter type.
      for (const p of profiles) {
        for (const pt of parameterTypes) {
          if (Number(pt.is_builtin) === 0 && !profileParameterTypes.some((r) => r.profile_id === p.id && r.parameter_type_id === pt.id)) {
            profileParameterTypes.push({ profile_id: p.id, parameter_type_id: pt.id });
          }
        }
      }
      return;
    }
    if (sql.startsWith('INSERT OR IGNORE INTO profile_parameter_types')) {
      const [profile_id, parameter_type_id] = params;
      if (!profileParameterTypes.some((r) => r.profile_id === profile_id && r.parameter_type_id === parameter_type_id)) {
        profileParameterTypes.push({ profile_id, parameter_type_id });
      }
      return;
    }
    if (sql.startsWith('INSERT OR REPLACE INTO profile_parameter_types')) {
      const [profile_id, parameter_type_id] = params;
      profileParameterTypes = profileParameterTypes.filter((r) => !(r.profile_id === profile_id && r.parameter_type_id === parameter_type_id));
      profileParameterTypes.push({ profile_id, parameter_type_id });
      return;
    }
    if (sql.startsWith('INSERT OR REPLACE INTO parameter_types')) {
      const [id, display_name, icon, color, is_builtin, field_definitions] = params;
      parameterTypes = parameterTypes.filter((p) => p.id !== id);
      parameterTypes.push({ id, display_name, icon, color, is_builtin, field_definitions });
      return;
    }
    if (sql.startsWith('INSERT INTO parameter_types')) {
      const [id, display_name, icon, color, is_builtin, field_definitions] = params;
      parameterTypes.push({ id, display_name, icon, color, is_builtin, field_definitions });
      return;
    }
    if (sql.startsWith('UPDATE parameter_types SET')) {
      const [display_name, field_definitions, id] = params;
      const p = parameterTypes.find((p) => p.id === id && Number(p.is_builtin) === 0);
      if (p) { p.display_name = display_name; p.field_definitions = field_definitions; }
      return;
    }
    if (sql.startsWith('DELETE FROM parameter_types')) {
      const [id] = params;
      parameterTypes = parameterTypes.filter((p) => !(p.id === id && Number(p.is_builtin) === 0));
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
  getAllAsync: async (sql, params = []) => {
    if (sql.startsWith('SELECT * FROM profiles')) return profiles;
    if (sql.startsWith('SELECT parameter_type_id FROM profile_parameter_types WHERE profile_id')) {
      const [profile_id] = params;
      return profileParameterTypes.filter((r) => r.profile_id === profile_id).map((r) => ({ parameter_type_id: r.parameter_type_id }));
    }
    if (sql.startsWith('SELECT * FROM profile_parameter_types')) return profileParameterTypes;
    // fetchParameterTypesForProfile(profileId) with a non-null profileId: built-ins plus
    // whichever custom types this profile has a profile_parameter_types row for.
    if (sql.startsWith('SELECT pt.* FROM parameter_types pt')) {
      const [profile_id] = params;
      const allowed = new Set(profileParameterTypes.filter((r) => r.profile_id === profile_id).map((r) => r.parameter_type_id));
      return parameterTypes.filter((pt) => Number(pt.is_builtin) === 1 || allowed.has(pt.id));
    }
    // fetchParameterTypesForProfile(null): built-ins only.
    if (sql.startsWith('SELECT * FROM parameter_types WHERE is_builtin = 1')) {
      return parameterTypes.filter((pt) => Number(pt.is_builtin) === 1);
    }
    if (sql.startsWith('SELECT * FROM parameter_types')) return parameterTypes;
    // Must come before the unconditional 'SELECT * FROM readings' branch below (used
    // unfiltered by backup.ts) — this scoped form (readingService.ts's
    // fetchReadingsForProfile) previously matched that same unconditional branch and
    // silently ignored the WHERE profile_id filter, returning every profile's readings.
    if (sql.startsWith('SELECT * FROM readings WHERE profile_id')) {
      const [profile_id] = params;
      return readings.filter((r) => r.profile_id === profile_id);
    }
    if (sql.startsWith('SELECT * FROM readings')) return readings;
    throw new Error('Unhandled getAllAsync SQL in fakeDb: ' + sql);
  },
  getFirstAsync: async (sql, params = []) => {
    if (sql.startsWith('SELECT COUNT(*) as count FROM readings WHERE parameter_type_id')) {
      const [parameter_type_id] = params;
      return { count: readings.filter((r) => r.parameter_type_id === parameter_type_id).length };
    }
    return null;
  },
  execAsync: async () => {},
  _seedProfiles: (rows) => { profiles = rows; },
  _seedReadings: (rows) => { readings = rows; },
  _seedParameterTypes: (rows) => { parameterTypes = rows; },
  _seedProfileParameterTypes: (rows) => { profileParameterTypes = rows; },
  _reset: reset
};

module.exports = { getDB: () => db, __fakeDb: db };
