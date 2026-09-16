import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Modal, Alert, Platform, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useProfile } from '../services/profileContext';
import { ageFromDOB } from '../services/utils';
import { Screen, Button, Card, EmptyState } from '../theme/components';
import { colors, spacing, typography, radius } from '../theme/tokens';
import { Profile } from '../types';

type FormState = {
  id?: string;
  name: string;
  date_of_birth: Date | null;
  glucose_unit_pref: 'mg/dL' | 'mmol/L';
  weight_unit_pref: 'kg' | 'lb';
};

const emptyForm: FormState = { name: '', date_of_birth: null, glucose_unit_pref: 'mg/dL', weight_unit_pref: 'kg' };

export default function ProfileManager({ navigation }: any) {
  const { profiles, addProfile, editProfile, deleteProfile, setActiveProfile } = useProfile();
  const [modalOpen, setModalOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const openAdd = () => { setForm(emptyForm); setModalOpen(true); };

  const openEdit = (p: Profile) => {
    setForm({
      id: p.id,
      name: p.name,
      date_of_birth: p.date_of_birth ? new Date(p.date_of_birth) : null,
      glucose_unit_pref: p.glucose_unit_pref ?? 'mg/dL',
      weight_unit_pref: p.weight_unit_pref ?? 'kg'
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return Alert.alert('Name required');
    const payload = {
      name: form.name.trim(),
      date_of_birth: form.date_of_birth ? form.date_of_birth.toISOString().slice(0, 10) : null,
      glucose_unit_pref: form.glucose_unit_pref,
      weight_unit_pref: form.weight_unit_pref
    };
    if (form.id) {
      await editProfile(form.id, payload);
    } else {
      await addProfile(payload);
    }
    setModalOpen(false);
  };

  const remove = (p: Profile) => {
    Alert.alert('Delete profile', `Delete ${p.name} and all their readings? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteProfile(p.id) }
    ]);
  };

  return (
    <Screen>
      <Text style={typography.h1}>Profiles</Text>
      <FlatList
        style={{ marginTop: spacing.lg }}
        data={profiles}
        keyExtractor={p => p.id}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => {
          const age = ageFromDOB(item.date_of_birth);
          return (
            <Card style={styles.row}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => { setActiveProfile(item.id); navigation.goBack(); }}>
                <Text style={typography.bodyBold}>{item.name}</Text>
                <Text style={typography.caption}>
                  {age !== null ? `${age} years old` : 'DOB not set'} · {item.glucose_unit_pref ?? 'mg/dL'} · {item.weight_unit_pref ?? 'kg'}
                </Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <TouchableOpacity onPress={() => openEdit(item)}><Text style={{ color: colors.primary, fontWeight: '600' }}>Edit</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => remove(item)}><Text style={{ color: colors.danger, fontWeight: '600' }}>Delete</Text></TouchableOpacity>
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={() => <EmptyState title="No profiles yet" subtitle="Add a profile to start tracking readings." />}
      />

      <Button label="Add Profile" onPress={openAdd} style={{ marginTop: spacing.lg }} />

      <Modal visible={modalOpen} animationType="slide">
        <Screen scroll>
          <Text style={typography.h1}>{form.id ? 'Edit Profile' : 'New Profile'}</Text>

          <Text style={[typography.bodyBold, styles.label]}>Name</Text>
          <TextInput placeholder="Name" value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))} style={styles.input} />

          <Text style={[typography.bodyBold, styles.label]}>Date of birth</Text>
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.input}>
            <Text>{form.date_of_birth ? form.date_of_birth.toLocaleDateString() : 'Not set'}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={form.date_of_birth ?? new Date(1990, 0, 1)}
              mode="date"
              maximumDate={new Date()}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, d) => { setShowDatePicker(false); if (d) setForm(f => ({ ...f, date_of_birth: d })); }}
            />
          )}

          <Text style={[typography.bodyBold, styles.label]}>Glucose unit</Text>
          <View style={styles.segmented}>
            {(['mg/dL', 'mmol/L'] as const).map(u => (
              <TouchableOpacity key={u} onPress={() => setForm(f => ({ ...f, glucose_unit_pref: u }))} style={[styles.segment, form.glucose_unit_pref === u && styles.segmentActive]}>
                <Text style={{ color: form.glucose_unit_pref === u ? colors.textOnPrimary : colors.primary }}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[typography.bodyBold, styles.label]}>Weight unit</Text>
          <View style={styles.segmented}>
            {(['kg', 'lb'] as const).map(u => (
              <TouchableOpacity key={u} onPress={() => setForm(f => ({ ...f, weight_unit_pref: u }))} style={[styles.segment, form.weight_unit_pref === u && styles.segmentActive]}>
                <Text style={{ color: form.weight_unit_pref === u ? colors.textOnPrimary : colors.primary }}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xl }}>
            <Button label="Cancel" variant="secondary" onPress={() => setModalOpen(false)} />
            <Button label="Save" onPress={save} />
          </View>
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { marginTop: spacing.lg, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surface },
  segmented: { flexDirection: 'row', gap: spacing.sm },
  segment: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary },
  segmentActive: { backgroundColor: colors.primary }
});
