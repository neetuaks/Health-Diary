import { getDB } from '../db/init';
import { ParameterType } from '../types';
import { v4 as uuidv4 } from 'uuid';

export async function fetchParameterTypes(): Promise<ParameterType[]> {
  const db = getDB();
  const rows = await db.getAllAsync<any>('SELECT * FROM parameter_types;');
  return rows.map((r: any) => ({ ...r, field_definitions: JSON.parse(r.field_definitions) })) as ParameterType[];
}

export async function insertParameterType(
  pt: Pick<ParameterType, 'display_name' | 'field_definitions'> & { icon?: string | null; color?: string | null }
): Promise<ParameterType> {
  const db = getDB();
  const id = uuidv4();
  // Bound through local, non-optional variables rather than read back off a
  // `ParameterType`-typed object: ParameterType declares icon/color/is_builtin as
  // optional (`icon?: string | null`), so TS would widen each to include `undefined`
  // again on access, which runAsync's SQLiteBindValue params reject.
  const icon: string | null = pt.icon ?? null;
  const color: string | null = pt.color ?? null;
  const fieldDefinitionsJson = JSON.stringify(pt.field_definitions);
  await db.runAsync(
    'INSERT INTO parameter_types (id, display_name, icon, color, is_builtin, field_definitions) VALUES (?,?,?,?,?,?);',
    [id, pt.display_name, icon, color, 0, fieldDefinitionsJson]
  );
  return { id, display_name: pt.display_name, icon, color, is_builtin: 0, field_definitions: pt.field_definitions };
}

// Guarded with `AND is_builtin = 0` so a bug in the calling UI can never edit BP/Glucose —
// the built-in types are owned by the app, not the user (see seed.ts).
export async function updateParameterType(pt: ParameterType): Promise<void> {
  const db = getDB();
  await db.runAsync(
    'UPDATE parameter_types SET display_name = ?, field_definitions = ? WHERE id = ? AND is_builtin = 0;',
    [pt.display_name, JSON.stringify(pt.field_definitions), pt.id]
  );
}

// Same is_builtin guard as updateParameterType.
export async function deleteParameterType(id: string): Promise<void> {
  const db = getDB();
  await db.runAsync('DELETE FROM parameter_types WHERE id = ? AND is_builtin = 0;', [id]);
}

// parameter_types has no profile_id column — it's shared across every profile — so this
// counts readings for the type across all profiles, not just the active one.
export async function countReadingsForParameterType(id: string): Promise<number> {
  const db = getDB();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM readings WHERE parameter_type_id = ?;', [id]);
  return row?.count ?? 0;
}
