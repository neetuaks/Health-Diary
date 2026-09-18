import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { fetchParameterTypes } from '../services/parameterRegistry';
import { insertReading, updateReading } from '../services/readingService';
import { useProfile } from '../services/profileContext';
import { classifyBP, clinicalColorKey, clinicalLabel, mgdlToMmolL, mmolLToMgdl } from '../services/utils';
import { ParameterType, Reading, FieldDefinition } from '../types';
import { Screen, Card, Banner } from '../theme/components';
import { colors, spacing, typography, radius } from '../theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
  editingReading?: Reading | null;
  initialValues?: { parameter_type_id?: string; vals?: Record<string, any>; source?: 'manual'|'photo'; confidence?: number; lowConfidence?: boolean } | null;
  // When provided, shows a camera icon in the header (new entries only — editing an
  // existing reading has no "rescan" concept) so Diary's "+" can open straight into
  // this manual-entry screen without an extra "Manual Entry vs Photo" chooser step,
  // while still surfacing the OCR path from right here instead of losing it.
  onScanPhoto?: () => void;
};

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

export default function NewRecordModal({ visible, onClose, onSaved, editingReading, initialValues, onScanPhoto }: Props) {
  const { activeProfile } = useProfile();
  const [types, setTypes] = useState<ParameterType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [recordedAt, setRecordedAt] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  // Bumped every time the form (re)opens (see effect below) and mixed into each
  // NumericInput's `key` — NumericInput owns its own local display text (deliberately,
  // so unit conversion doesn't fight every keystroke) and only resyncs it from props
  // when glucoseUnitPref changes. Without this, reopening the modal for a new "Add"
  // — or for editing a *different* reading — left the previous session's typed text
  // sitting in that local state: the parent's `values` was correctly reset/reloaded,
  // but the input kept showing stale text, so Save would then reject the (actually
  // empty) required field, or Edit would appear blank instead of pre-filled.
  const [formVersion, setFormVersion] = useState(0);

  // Runs every time the modal is opened, not just on mount — this component stays
  // mounted between opens (the screen only toggles `visible`), so without this the
  // previous session's form state (a stale edited date, leftover field values) would
  // bleed into the next "new record" instead of starting fresh.
  useEffect(() => {
    if (!visible) return;
    setFormVersion(v => v + 1);
    if (editingReading) {
      setValues(editingReading.vals || {});
      setSelectedTypeId(editingReading.parameter_type_id);
      setRecordedAt(new Date(editingReading.recorded_at));
    } else if (initialValues) {
      setSelectedTypeId(initialValues.parameter_type_id ?? null);
      setValues(initialValues.vals || {});
      setRecordedAt(initialValues.vals?.recorded_at ? new Date(initialValues.vals.recorded_at) : new Date());
    } else {
      setValues({});
      setSelectedTypeId(null);
      setRecordedAt(new Date());
    }
  }, [visible, editingReading, initialValues]);

  useEffect(() => {
    fetchParameterTypes().then(setTypes);
  }, []);

  // Depends on selectedTypeId too (not just types) — the modal-open reset effect above
  // clears selectedTypeId to null on every fresh "Add", and `types` itself only loads
  // once near app start, so a `[types]`-only dependency would auto-select just the
  // first time ever and leave every later "New Record" open with no type selected
  // (and therefore no field inputs rendered at all).
  useEffect(() => {
    if (types.length > 0 && !selectedTypeId) setSelectedTypeId(types[0].id);
  }, [types, selectedTypeId]);

  const selectedType = types.find(t => t.id === selectedTypeId) ?? null;
  const glucoseUnitPref = activeProfile?.glucose_unit_pref;

  // Pre-fills a field's registry-defined default (e.g. BP's "arm" defaulting to
  // "left", or Glucose's "test_type" defaulting to "fasting") whenever it's missing
  // — a fresh add, but also an existing reading being edited if it predates that
  // field (e.g. a glucose reading saved before "Test Type" existed). It only ever
  // fills a gap, never overwrites a value the reading actually has, so editing a
  // reading's own real saved value (however it was originally chosen) is untouched.
  useEffect(() => {
    if (!visible || !selectedType) return;
    setValues(prev => {
      let changed = false;
      const next = { ...prev };
      selectedType.field_definitions.forEach(f => {
        if (f.default !== undefined && f.default !== null && (next[f.key] === undefined || next[f.key] === '')) {
          next[f.key] = f.default;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [visible, editingReading, selectedTypeId, types]);

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
    // The only future-date/time check — deliberately not duplicated in the date/time
    // pickers' own onChange handlers. Checking there too rejected the ordinary act of
    // picking a new date while the old time-of-day was still attached: e.g. editing a
    // reading dated "yesterday 9pm" and changing just the date to today, at 3pm, would
    // combine into "today 9pm" — later than right now — and get silently rejected
    // before the user had a chance to also fix the time, making the date edit appear
    // to just not save.
    if (recordedAt.getTime() > Date.now()) {
      Alert.alert('Invalid date/time', 'Recorded time cannot be in the future.');
      return;
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

    // save() had no error handling at all — an update/insert failure threw silently
    // (no alert, modal just stayed open, edit lost with zero feedback), which is
    // indistinguishable from "the date change didn't save" from the user's side.
    try {
      if (editingReading) {
        const updated: Reading = { ...editingReading, ...readingPayload };
        await updateReading(updated);
      } else {
        await insertReading(readingPayload);
      }
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
      return;
    }
    onSaved && onSaved();
    onClose();
  };

  const divider = { borderBottomWidth: 1, borderBottomColor: colors.border };

  return (
    <Modal visible={visible} animationType="slide">
      <Screen>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={onClose} style={styles.iconButton} accessibilityLabel="Cancel">
            <Text style={styles.iconButtonGlyph}>{'✕'}</Text>
          </TouchableOpacity>
          <Text style={typography.h2}>{editingReading ? `Edit ${selectedType?.display_name ?? 'Record'}` : 'New Record'}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {!editingReading && onScanPhoto && (
              <TouchableOpacity onPress={onScanPhoto} style={styles.iconButton} accessibilityLabel="Scan with camera">
                <Text style={styles.iconButtonGlyph}>{'📷'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={save} style={[styles.iconButton, styles.iconButtonPrimary]} accessibilityLabel="Save">
              <Text style={[styles.iconButtonGlyph, { color: colors.primaryDark }]}>{'✓'}</Text>
            </TouchableOpacity>
          </View>
        </View>

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
          {!editingReading && (
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {types.map(t => (
                <TouchableOpacity key={t.id} onPress={() => setSelectedTypeId(t.id)} style={[styles.chip, selectedTypeId === t.id && styles.chipActive]}>
                  <Text style={{ color: selectedTypeId === t.id ? colors.primaryDark : colors.primary, fontWeight: '600' }}>{t.display_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Card style={styles.formCard}>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[styles.fieldRow, divider]}>
              <Text style={typography.body}>Date</Text>
              <Text style={typography.bodyBold}>{recordedAt.toLocaleDateString()}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTimePicker(true)} style={[styles.fieldRow, selectedType && styles.fieldRowDivider]}>
              <Text style={typography.body}>Time</Text>
              <Text style={typography.bodyBold}>{recordedAt.toLocaleTimeString()}</Text>
            </TouchableOpacity>

            {selectedType && selectedType.field_definitions.map((f, i) => {
              const warning = outOfRangeWarning(f, values[f.key]);
              const isLast = i === selectedType.field_definitions.length - 1;
              return (
                <View key={f.key} style={!isLast ? styles.fieldRowDivider : undefined}>
                  <View style={styles.fieldRow}>
                    <Text style={[typography.body, styles.fieldLabel]}>
                      {f.label}{f.required ? <Text style={{ color: colors.danger }}> *</Text> : null}
                    </Text>
                    {f.dataType === 'numeric' ? (
                      <NumericInput
                        key={`${f.key}-v${formVersion}`}
                        field={f}
                        canonicalValue={values[f.key]}
                        glucoseUnitPref={glucoseUnitPref}
                        onChangeCanonical={v => setValues(prev => ({ ...prev, [f.key]: v }))}
                        style={styles.inlineInput}
                      />
                    ) : f.dataType === 'enum' ? (
                      <View style={{ flex: 1, flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {(f.options || []).map(opt => (
                          <TouchableOpacity key={opt} onPress={() => setValues(prev => ({ ...prev, [f.key]: opt }))} style={[styles.chip, values[f.key] === opt && styles.chipActive]}>
                            <Text style={{ color: values[f.key] === opt ? colors.primaryDark : colors.primary }}>{f.optionLabels?.[opt] ?? opt}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : (
                      <TextInput style={styles.inlineInput} value={values[f.key] ?? ''} onChangeText={t => setValues(prev => ({ ...prev, [f.key]: t }))} />
                    )}
                  </View>
                  {warning && <Text style={styles.warningText}>{warning}</Text>}
                </View>
              );
            })}
          </Card>

          {bpClassification && (
            <View style={[styles.classificationBadge, { backgroundColor: colors[`${clinicalColorKey(bpClassification)}Bg` as 'successBg' | 'warningBg' | 'orangeBg' | 'dangerBg'] }]}>
              <Text style={{ color: colors[clinicalColorKey(bpClassification)], fontWeight: '700' }}>
                {clinicalLabel(bpClassification)}
              </Text>
            </View>
          )}
        </ScrollView>

        {showDatePicker && (
          <DateTimePicker
            value={recordedAt}
            mode="date"
            maximumDate={new Date()}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            // onChange is deprecated (and, on Android, ambiguous — the library falls
            // back to firing it on cancel/dismiss too, with the *original* unchanged
            // value, since no onDismiss was given). onValueChange only ever fires for
            // an actual picked value, which is what was needed here.
            onValueChange={(_, d) => {
              setShowDatePicker(false);
              const next = new Date(d);
              next.setHours(recordedAt.getHours(), recordedAt.getMinutes());
              // Picking today's date while the reading's existing time-of-day is
              // still later than right now (e.g. moving a reading logged "yesterday
              // 9pm" to today at 3pm) would combine into a future instant. Clamping
              // to now — rather than rejecting the whole date change at Save — is
              // what actually lets a plain date correction go through; blocking it
              // here made changing just the date effectively impossible whenever the
              // old time-of-day happened to be later than the current clock time.
              setRecordedAt(next.getTime() > Date.now() ? new Date() : next);
            }}
            onDismiss={() => setShowDatePicker(false)}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={recordedAt}
            mode="time"
            is24Hour={false}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onValueChange={(_, d) => {
              setShowTimePicker(false);
              const next = new Date(recordedAt);
              next.setHours(d.getHours(), d.getMinutes());
              setRecordedAt(next.getTime() > Date.now() ? new Date() : next);
            }}
            onDismiss={() => setShowTimePicker(false)}
          />
        )}
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  iconButtonPrimary: { backgroundColor: colors.primaryMuted },
  iconButtonGlyph: { fontSize: 16, fontWeight: '700', color: colors.text },
  chip: { padding: spacing.sm, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.pill, marginRight: spacing.sm, marginBottom: spacing.sm },
  chipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primaryMuted },
  formCard: { padding: 0, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
  fieldRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  fieldLabel: { flexShrink: 1, marginRight: spacing.md },
  // flex: 1 gives this a real, deterministic width within the row (rather than relying
  // on minWidth alone in an unconstrained flex row) so it's reliably tappable/editable,
  // and padding gives it a large enough hit target on Android.
  inlineInput: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'right', paddingVertical: spacing.xs },
  warningText: { color: colors.warning, marginBottom: spacing.sm, fontSize: 13 },
  classificationBadge: { padding: spacing.md, borderRadius: radius.md, alignSelf: 'flex-start', marginTop: spacing.md }
});
