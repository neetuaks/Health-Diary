import { getDB } from '../db/init';
import { ParameterType } from '../types';

export async function fetchParameterTypes(): Promise<ParameterType[]> {
  const db = getDB();
  const rows = await db.getAllAsync<any>('SELECT * FROM parameter_types;');
  return rows.map((r: any) => ({ ...r, field_definitions: JSON.parse(r.field_definitions) })) as ParameterType[];
}
