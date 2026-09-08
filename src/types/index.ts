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
  values: Record<string, any>;
  notes?: string | null;
};
