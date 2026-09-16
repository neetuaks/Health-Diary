import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { fetchParameterTypes } from '../services/parameterRegistry';
import { insertReading, updateReading } from '../services/readingService';
import { useProfile } from '../services/profileContext';
import { classifyBP, clinicalColorKey, mgdlToMmolL, mmolLToMgdl } from '../services/utils';
import { ParameterType, Reading, FieldDefinition } from '../types';
import { Screen, Button, Banner } from '../theme/components';
import { colors, spacing, typography, radius } from '../theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
  editingReading?: Reading | null;
  initialValues?: { parameter_type_id?: string; vals?: Record<string, any>; source?: 'manual'|'photo'; confidence?: number; lowConfidence?: boolean } | null;
};

// A numeric field whose canonical unit is mg/dL gets converted for display/entry
// when the active profile prefers mmol/L (see docs/PRODUCT-SPEC.md "Units").
function displayUnit(field: FieldDefinition, glucoseUnitPref?: string) {
  if (field.unit === 'mg/dL' && glucoseUnitPref === 'mmol/L') return 'mmol/L';
  return field.unit;
}

function toDisplayValue(field: FieldDefinition, raw: any, glucoseUnitPref?: string) {
  if (field.unit === 'mg/dL' && glucoseUnitPref === 'mmol/L' && raw !== undefined && raw !== '' && !isNaN(Number(raw))) {
    return String(mgdlToMmolL(Number(raw)));
  }
  return raw?.toString() ?? '';
}

function toCanonicalValue(field: FieldDefinition, displayVal: string, glucoseUnitPref?: string): number {
  const n = Number(displayVal);
  if (field.unit === 'mg/dL' && glucoseUnitPref === 'mmol/L') return mmolLToMgdl(n);
  return n;
}

// Owns its own display text so unit conversion only happens at the boundaries
// (initial mount, unit-pref change) rather than on every keystroke — converting
// on every keystroke fights the controlled input (cursor jumps, decimals snap away).
function NumericInput({ field, canonicalValue, glucoseUnitPref, onChangeCanonical, style }: {
  field: FieldDefinition;
  canonicalValue: any;
  glucoseUnitPref?: string;
  onChangeCanonical: (v: number | '') => void;
  style: any;
}) {
  const [text, setText] = useState(() => toDisplayValue(field, canonicalValue, glucoseUnitPref));

  useEffect(() => {
    setText(toDisplayValue(field, canonicalValue, glucoseUnitPref));
    // Only resync from the unit preference, not from canonicalValue changing on
    // every keystroke of this same input (that would fight what the user is typing).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glucoseUnitPref]);

  return (
    <TextInput
      keyboardType="numeric"
      style={style}
      value={text}
      onChangeText={t => {
        setText(t);
        if (t === '') { onChangeCanonical(''); return; }
        const n = Number(t);
        if (!isNaN(n)) onChangeCanonical(toCanonicalValue(field, t, glucoseUnitPref));
      }}
    />
  );
}

export default function NewRecordModal({ visible, onClose, onSaved, editingReading, initialValues }: Props) {
  const { activeProfile } = useProfile();
  const [types, setTypes] = useState<ParameterType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [recordedAt, setRecordedAt] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (editingReading) {
      setValues(editingReading.vals || {});
      setSelectedTypeId(editingReading.parameter_type_id);
      setRecordedAt(new Date(editingReading.recorded_at));
    }
    if (initialValues && !editingReading) {
      if (initialValues.parameter_type_id) setSelectedTypeId(initialValues.parameter_type_id);
      if (initialValues.vals) setValues(initialValues.vals);
      if (initialValues.vals?.recorded_at) setRecordedAt(new Date(initialValues.vals.recorded_at));
    }
  }, [editingReading, initialValues]);

  useEffect(() => {
    fetchParameterTypes().then(setTypes);
  }, []);

  useEffect(() => {
    if (types.length > 0 && !selectedTypeId) setSelectedTypeId(types[0].id);
  }, [types]);

  const selectedType = types.find(t => t.id === selectedTypeId) ?? null;
  const glucoseUnitPref = activeProfile?.glucose_unit_pref;

  const outOfRangeWarning = (f: FieldDefinition, raw: any): string | null => {
    if (f.dataType !== 'numeric' || raw === undefined || raw === '') return null;
    const n = Number(raw);
    if (isNaN(n)) return null;
    if (f.min !== undefined && f.min !== null && n < f.min) return `Below the usual range (min ${f.min}${f.unit ? ` ${f.unit}` : ''})`;
    if (f.max !== undefined && f.max !== null && n > f.max) return `Above the usual range (max ${f.max}${f.unit ? ` ${f.unit}` : ''})`;
    return null;
  };

  const bpClassification = (values.systolic !== undefined && values.systolic !== '' && values.diastolic !== undefined && values.diastolic !== '')
    ? classifyBP(Number(values.systolic), Number(values.diastolic))
    : null;

  const save = async () => {
    if (!activeProfile || !selectedType) return;
    for (const f of selectedType.field_definitions) {
      if (f.required && (values[f.key] === undefined || values[f.key] === '')) {
        Alert.alert('Missing', `${f.label} is required`);
        return;
      }
    }

    const readingPayload = {
      profile_id: activeProfile.id,
      parameter_type_id: selectedType.id,
      recorded_at: recordedAt.toISOString(),
      source: 'manual' as const,
      vals: values
    } as any;

    if (initialValues && initialValues.source === 'photo') {
      readingPayload.source = 'photo';
    }

    if (editingReading) {
      const updated: Reading = { ...editingReading, ...readingPayload };
      await updateReading(updated);
    } else {
      await insertReading(readingPayload);
    }
    onSaved && onSaved();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide">
      <Screen>
        <Text style={typography.h1}>New Record</Text>
        <ScrollView style={{ marginTop: spacing.md }}>
          {initialValues?.source === 'photo' && (
            initialValues.lowConfidence ? (
              <Banner
                variant="warning"
                title="Couldn't read this photo confidently"
                message="We left the fields blank rather than guess — please choose a parameter type and enter the values manually."
              />
            ) : (
              <Banner
                variant="info"
                title="Prefilled from photo"
                message="Please double-check these values against the device display before saving."
              />
            )
          )}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {types.map(t => (
              <TouchableOpacity key={t.id} onPress={() => setSelectedTypeId(t.id)} style={[styles.chip, selectedTypeId === t.id && styles.chipActive]}>
                <Text style={{ color: selectedTypeId === t.id ? colors.textOnPrimary : colors.primary, fontWeight: '600' }}>{t.display_name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {selectedType && (
            <View style={{ marginTop: spacing.lg }}>
              {selectedType.field_definitions.map((f) => {
                const unit = displayUnit(f, glucoseUnitPref);
                const warning = outOfRangeWarning(f, values[f.key]);
                return (
                  <View key={f.key} style={{ marginBottom: spacing.lg }}>
                    <Text style={typography.bodyBold}>
                      {f.label}{unit ? ` (${unit})` : ''}{f.required ? <Text style={{ color: colors.danger }}> *</Text> : null}
                    </Text>
                    {f.dataType === 'numeric' ? (
                      <NumericInput
                        field={f}
                        canonicalValue={values[f.key]}
                        glucoseUnitPref={glucoseUnitPref}
                        onChangeCanonical={v => setValues(prev => ({ ...prev, [f.key]: v }))}
                        style={styles.input}
                      />
                    ) : f.dataType === 'enum' ? (
                      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        {(f.options || []).map(opt => (
                          <TouchableOpacity key={opt} onPress={() => setValues(prev => ({ ...prev, [f.key]: opt }))} style={[styles.chip, values[f.key] === opt && styles.chipActive]}>
                            <Text style={{ color: values[f.key] === opt ? colors.textOnPrimary : colors.primary }}>{opt}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : (
                      <TextInput style={styles.input} value={values[f.key] ?? ''} onChangeText={t => setValues(prev => ({ ...prev, [f.key]: t }))} />
                    )}
                    {warning && <Text style={styles.warningText}>{warning}</Text>}
                  </View>
                );
              })}

              {bpClassification && (
                <View style={[styles.classificationBadge, { backgroundColor: colors[`${clinicalColorKey(bpClassification)}Bg` as 'successBg' | 'warningBg' | 'dangerBg'] }]}>
                  <Text style={{ color: colors[clinicalColorKey(bpClassification)], fontWeight: '700' }}>
                    {bpClassification === 'hypertensive-crisis' ? 'Hypertensive crisis' : bpClassification[0].toUpperCase() + bpClassification.slice(1)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <View style={{ marginTop: spacing.sm }}>
          <Text style={typography.bodyBold}>Date & Time</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.chip}>
              <Text>{recordedAt.toLocaleDateString()}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.chip}>
              <Text>{recordedAt.toLocaleTimeString()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={recordedAt}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, d) => { setShowDatePicker(false); if (d) setRecordedAt(prev => new Date(d.setHours(prev.getHours(), prev.getMinutes()))); }}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={recordedAt}
            mode="time"
            is24Hour={false}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, d) => { setShowTimePicker(false); if (d) setRecordedAt(prev => { prev.setHours(d.getHours()); prev.setMinutes(d.getMinutes()); return new Date(prev); }); }}
          />
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg }}>
          <Button label="Cancel" variant="secondary" onPress={onClose} />
          <Button label="Save" onPress={save} />
        </View>
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  chip: { padding: spacing.sm, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, marginRight: spacing.sm },
  chipActive: { backgroundColor: colors.primary },
  input: { borderWidth: 1, borderColor: colors.border, padding: spacing.md, borderRadius: radius.md, fontSize: 20, marginTop: spacing.xs, backgroundColor: colors.surface },
  warningText: { color: colors.warning, marginTop: spacing.xs, fontSize: 13 },
  classificationBadge: { padding: spacing.md, borderRadius: radius.md, alignSelf: 'flex-start', marginTop: spacing.sm }
});
