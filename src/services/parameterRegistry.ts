import { getDB } from '../db/init';
import { ParameterType } from '../types';

export async function fetchParameterTypes(): Promise<ParameterType[]> {
  const db = getDB();
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql('SELECT * FROM parameter_types;', [], (_, res) => {
        const rows = res.rows._array.map((r: any) => ({ ...r, field_definitions: JSON.parse(r.field_definitions) })) as ParameterType[];
        resolve(rows);
      });
    }, err => reject(err));
  });
}
