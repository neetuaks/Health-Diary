import * as SecureStore from 'expo-secure-store';
import { getDB } from '../db/init';
import { ParameterType } from '../types';

// Built-in types (is_builtin = 1) are always available to every profile and never get a
// row here. A row in this table means "this custom parameter type is enabled for this
// profile" — see docs comment on the CREATE TABLE in src/db/init.ts.
export async function fetchParameterTypesForProfile(profileId: string | null): Promise<ParameterType[]> {
  const db = getDB();
  const rows = profileId
    ? await db.getAllAsync<any>(
        `SELECT pt.* FROM parameter_types pt
         WHERE pt.is_builtin = 1
            OR pt.id IN (SELECT parameter_type_id FROM profile_parameter_types WHERE profile_id = ?);`,
        [profileId]
      )
    : await db.getAllAsync<any>('SELECT * FROM parameter_types WHERE is_builtin = 1;');
  return rows.map((r: any) => ({ ...r, field_definitions: JSON.parse(r.field_definitions) })) as ParameterType[];
}

export async function fetchProfileParameterTypeIds(profileId: string): Promise<Set<string>> {
  const db = getDB();
  const rows = await db.getAllAsync<{ parameter_type_id: string }>(
    'SELECT parameter_type_id FROM profile_parameter_types WHERE profile_id = ?;',
    [profileId]
  );
  return new Set(rows.map(r => r.parameter_type_id));
}

export async function addParameterTypeToProfile(profileId: string, parameterTypeId: string): Promise<void> {
  const db = getDB();
  await db.runAsync(
    'INSERT OR IGNORE INTO profile_parameter_types (profile_id, parameter_type_id) VALUES (?,?);',
    [profileId, parameterTypeId]
  );
}

export async function removeParameterTypeFromProfile(profileId: string, parameterTypeId: string): Promise<void> {
  const db = getDB();
  await db.runAsync(
    'DELETE FROM profile_parameter_types WHERE profile_id = ? AND parameter_type_id = ?;',
    [profileId, parameterTypeId]
  );
}

// Used once, right after a new custom parameter type is created, to assign it to either
// every current profile ("All Profiles") or a specific subset ("Selected Profiles").
export async function assignParameterTypeToProfiles(parameterTypeId: string, profileIds: string[]): Promise<void> {
  for (const profileId of profileIds) {
    await addParameterTypeToProfile(profileId, parameterTypeId);
  }
}

const MIGRATION_FLAG_KEY = 'profile_parameter_scoping_migrated_v1';

// One-time backfill for installs upgrading from before per-profile scoping existed:
// every custom parameter type created before this shipped had no rows here, which would
// otherwise make it silently disappear from every profile. Backfills one row per
// (existing profile x existing custom type) pair, exactly once — guarded by a flag rather
// than "table is empty", since an empty table is also the correct state after a user
// removes a type from every profile, and only the flag can tell those two apart.
export async function backfillLegacyCustomParameterTypeScoping(): Promise<void> {
  const already = await SecureStore.getItemAsync(MIGRATION_FLAG_KEY);
  if (already) return;
  const db = getDB();
  await db.runAsync(
    'INSERT OR IGNORE INTO profile_parameter_types (profile_id, parameter_type_id) SELECT p.id, pt.id FROM profiles p CROSS JOIN parameter_types pt WHERE pt.is_builtin = 0;'
  );
  await SecureStore.setItemAsync(MIGRATION_FLAG_KEY, '1');
}
