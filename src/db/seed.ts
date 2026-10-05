import { SQLiteDatabase } from 'expo-sqlite';

export function seedParameterTypes(db: SQLiteDatabase) {
  // Insert built-in BP and Glucose parameter types if not present
  const bp = {
    id: 'bp',
    display_name: 'Blood Pressure',
    icon: 'heart',
    color: '#0077CC',
    is_builtin: 1,
    // Fixed sentinel timestamps, always earlier than any custom type's real
    // created_at, so BP/Glucose sort first even without the explicit id CASE
    // in the ORDER BY (belt and suspenders — see parameterRegistry.ts).
    created_at: '2000-01-01T00:00:00.000Z',
    field_definitions: JSON.stringify([
      { key: 'systolic', label: 'Systolic', dataType: 'numeric', unit: 'mmHg', min: 50, max: 260, required: true },
      { key: 'diastolic', label: 'Diastolic', dataType: 'numeric', unit: 'mmHg', min: 30, max: 160, required: true },
      { key: 'pulse', label: 'Pulse', dataType: 'numeric', unit: 'bpm', min: 30, max: 220, required: false },
      { key: 'arm', label: 'Arm', dataType: 'enum', options: ['left','right'], required: true, default: 'left' }
    ])
  };

  const glucose = {
    id: 'glucose',
    display_name: 'Glucose',
    icon: 'droplet',
    color: '#00AA77',
    is_builtin: 1,
    created_at: '2000-01-01T00:00:01.000Z',
    field_definitions: JSON.stringify([
      { key: 'value', label: 'Glucose', dataType: 'numeric', unit: 'mg/dL', min: 20, max: 600, required: true },
      {
        key: 'test_type',
        label: 'Test Type',
        dataType: 'enum',
        options: ['fasting', 'ogtt'],
        optionLabels: { fasting: 'Fasting Plasma Glucose (FPG)', ogtt: 'Oral Glucose Tolerance Test (OGTT)' },
        optionShortLabels: { fasting: 'FPG', ogtt: 'OGTT' },
        showInList: true,
        groupChartBy: true,
        required: true,
        default: 'fasting'
      }
    ])
  };

  // REPLACE, not IGNORE: these built-in types are owned by the app, not the user, so a
  // code change to their field_definitions (e.g. adding a default) must reach devices
  // that already seeded an older version instead of being silently skipped forever.
  db.runSync(
    'INSERT OR REPLACE INTO parameter_types (id, display_name, icon, color, is_builtin, field_definitions, created_at) VALUES (?,?,?,?,?,?,?);',
    [bp.id, bp.display_name, bp.icon, bp.color, bp.is_builtin, bp.field_definitions, bp.created_at]
  );
  db.runSync(
    'INSERT OR REPLACE INTO parameter_types (id, display_name, icon, color, is_builtin, field_definitions, created_at) VALUES (?,?,?,?,?,?,?);',
    [glucose.id, glucose.display_name, glucose.icon, glucose.color, glucose.is_builtin, glucose.field_definitions, glucose.created_at]
  );
}
