import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { fetchParameterTypes } from '../services/parameterRegistry';
import { insertReading, updateReading } from '../services/readingService';
import { useProfile } from '../services/profileContext';
import { ParameterType, Reading } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
  editingReading?: Reading | null;
  initialValues?: { parameter_type_id?: string; values?: Record<string, any>; source?: 'manual'|'photo' } | null;
};

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
      setValues(editingReading.values || {});
      setSelectedTypeId(editingReading.parameter_type_id);
      setRecordedAt(new Date(editingReading.recorded_at));
    }
    if (initialValues && !editingReading) {
      if (initialValues.parameter_type_id) setSelectedTypeId(initialValues.parameter_type_id);
      if (initialValues.values) setValues(initialValues.values);
      if (initialValues.values?.recorded_at) setRecordedAt(new Date(initialValues.values.recorded_at));
    }
  }, [editingReading, initialValues]);

  useEffect(() => {
    fetchParameterTypes().then(setTypes);
  }, []);

  useEffect(() => {
    if (types.length > 0 && !selectedTypeId) setSelectedTypeId(types[0].id);
  }, [types]);

  const selectedType = types.find(t => t.id === selectedTypeId) ?? null;

  const save = async () => {
    if (!activeProfile || !selectedType) return;
    // Basic required validation
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
      values
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
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '600' }}>New Record</Text>
        <ScrollView style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {types.map(t => (
              <TouchableOpacity key={t.id} onPress={() => setSelectedTypeId(t.id)} style={[styles.typeButton, selectedTypeId === t.id && styles.typeButtonActive]}>
                <Text style={{ color: selectedTypeId === t.id ? '#fff' : '#0077CC' }}>{t.display_name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {selectedType && (
            <View style={{ marginTop: 16 }}>
              {selectedType.field_definitions.map((f) => (
                <View key={f.key} style={{ marginBottom: 12 }}>
                  <Text style={{ marginBottom: 6 }}>{f.label}{f.unit ? ` (${f.unit})` : ''}</Text>
                  {f.key === 'recorded_at' ? null : null}
                  {f.dataType === 'numeric' ? (
                    <TextInput keyboardType="numeric" style={styles.input} value={values[f.key]?.toString() ?? ''} onChangeText={t => setValues(prev => ({ ...prev, [f.key]: t }))} />
                  ) : f.dataType === 'enum' ? (
                    <View style={{ flexDirection: 'row' }}>
                      {(f.options || []).map(opt => (
                        <TouchableOpacity key={opt} onPress={() => setValues(prev => ({ ...prev, [f.key]: opt }))} style={[styles.typeButton, values[f.key] === opt && styles.typeButtonActive]}>
                          <Text style={{ color: values[f.key] === opt ? '#fff' : '#0077CC' }}>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <TextInput style={styles.input} value={values[f.key] ?? ''} onChangeText={t => setValues(prev => ({ ...prev, [f.key]: t }))} />
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={{ marginTop: 8 }}>
          <Text style={{ marginBottom: 6 }}>Date & Time</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[styles.typeButton]}> 
              <Text>{recordedAt.toLocaleDateString()}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTimePicker(true)} style={[styles.typeButton]}> 
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

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
          <TouchableOpacity onPress={onClose} style={styles.secondaryButton}><Text>Cancel</Text></TouchableOpacity>
          <TouchableOpacity onPress={save} style={styles.primaryButton}><Text style={{ color: '#fff' }}>Save</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  typeButton: { padding: 8, borderWidth: 1, borderColor: '#0077CC', borderRadius: 6, marginRight: 8 },
  typeButtonActive: { backgroundColor: '#0077CC' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 6 },
  primaryButton: { backgroundColor: '#0077CC', padding: 12, borderRadius: 8 },
  secondaryButton: { padding: 12, borderRadius: 8 }
});
