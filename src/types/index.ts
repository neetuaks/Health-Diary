export type UUID = string;

export type Profile = {
  id: UUID;
  name: string;
  date_of_birth?: string | null;
  glucose_unit_pref?: 'mg/dL' | 'mmol/L';
  weight_unit_pref?: 'kg' | 'lb';
  last_backup_at?: string | null;
};

export type FieldDefinition = {
  key: string;
  label: string;
  dataType: 'numeric' | 'text' | 'enum';
  unit?: string | null;
  min?: number | null;
  max?: number | null;
  required?: boolean;
  options?: string[] | null;
  // Display text per option value, for an enum whose stored value should be short
  // (e.g. 'fasting') but whose on-screen label should spell the full clinical term
  // out (e.g. "Fasting Plasma Glucose (FPG)"). Falls back to the raw option string
  // when unset.
  optionLabels?: Record<string, string> | null;
  // Compact per-option label for narrow table columns (Diary/Report/PDF), where the
  // full optionLabels text would overflow (e.g. 'FPG' instead of "Fasting Plasma
  // Glucose (FPG)"). Falls back to optionLabels, then the raw option string.
  optionShortLabels?: Record<string, string> | null;
  // Include this non-numeric field as its own column in the compact Diary/Report
  // tables (numeric fields are always included; this opts a specific enum/text
  // field in too — e.g. Glucose's "Test Type" — without pulling in every enum
  // field on every parameter type, like BP's "Arm").
  showInList?: boolean;
  // Marks an enum field whose values should split the Chart tab into separate
  // lines/legend entries instead of one combined line — e.g. Glucose's "Test Type"
  // produces a Fasting line and an OGTT line rather than mixing both onto one,
  // since they're on different clinical scales. Only meaningful on a parameter type
  // with exactly one numeric field; ignored otherwise.
  groupChartBy?: boolean;
  default?: string | number | null;
};

export type ParameterType = {
  id: string;
  display_name: string;
  icon?: string | null;
  color?: string | null;
  is_builtin?: number;
  field_definitions: FieldDefinition[];
};

export type Reading = {
  id: UUID;
  profile_id: UUID;
  parameter_type_id: string;
  recorded_at: string;
  created_at: string;
  source: 'manual' | 'photo' | 'bluetooth';
  vals: Record<string, any>;
  notes?: string | null;
};
