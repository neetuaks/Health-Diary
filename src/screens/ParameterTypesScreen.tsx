import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Modal, Alert, StyleSheet } from 'react-native';
import { ParameterType, FieldDefinition } from '../types';
import {
  fetchParameterTypes,
  insertParameterType,
  updateParameterType,
  deleteParameterType,
  countReadingsForParameterType
} from '../services/parameterRegistry';
import { slugifyFieldKey } from '../services/utils';
import { Screen, Card, Button, EmptyState } from '../theme/components';
import { colors, spacing, typography, radius } from '../theme/tokens';

type FieldDataType = 'numeric' | 'text' | 'enum';

// Local editor state for one field row. `key` is null for a field that doesn't exist yet
// (its FieldDefinition.key is computed from the label at save time) and set to the real,
// immutable key for a field carried over from an existing type being edited — see
// slugifyFieldKey's doc comment for why an existing key is never recomputed.
type FieldRowState = {
  localId: string;
  key: string | null;
  label: string;
  dataType: FieldDataType;
  unit: string;
  min: string;
  max: string;
  required: boolean;
  optionsText: string;
};

type FormState = {
  id?: string;
  display_name: string;
  fields: FieldRowState[];
};

function parseOptions(text: string): string[] {
  const seen = new Set<string>();
  const opts: string[] = [];
  for (const raw of text.split(',')) {
    const t = raw.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    opts.push(t);
  }
  return opts;
}

export default function ParameterTypesScreen() {
  const [types, setTypes] = useState<ParameterType[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ display_name: '', fields: [] });
  const newFieldCounter = useRef(0);

  const refresh = () => fetchParameterTypes().then(setTypes);

  useEffect(() => {
    refresh();
  }, []);

  const newFieldRow = (): FieldRowState => ({
    localId: `new-${newFieldCounter.current++}`,
    key: null,
    label: '',
    dataType: 'numeric',
    unit: '',
    min: '',
    max: '',
    required: true,
    optionsText: ''
  });

  const openAdd = () => {
    setForm({ display_name: '', fields: [newFieldRow()] });
    setModalOpen(true);
  };

  const openEdit = (pt: ParameterType) => {
    setForm({
      id: pt.id,
      display_name: pt.display_name,
      fields: pt.field_definitions.map(f => ({
        localId: f.key,
        key: f.key,
        label: f.label,
        dataType: f.dataType,
        unit: f.unit ?? '',
        min: f.min !== undefined && f.min !== null ? String(f.min) : '',
        max: f.max !== undefined && f.max !== null ? String(f.max) : '',
        required: !!f.required,
        optionsText: (f.options ?? []).join(', ')
      }))
    });
    setModalOpen(true);
  };

  const updateFieldRow = (idx: number, patch: Partial<FieldRowState>) => {
    setForm(f => ({ ...f, fields: f.fields.map((row, i) => (i === idx ? { ...row, ...patch } : row)) }));
  };

  const addField = () => setForm(f => ({ ...f, fields: [...f.fields, newFieldRow()] }));
  const removeField = (idx: number) => setForm(f => ({ ...f, fields: f.fields.filter((_, i) => i !== idx) }));

  const save = async () => {
    const name = form.display_name.trim();
    if (!name) {
      Alert.alert('Name required', 'Please enter a display name.');
      return;
    }
    const nameTaken = types.some(t => t.id !== form.id && t.display_name.trim().toLowerCase() === name.toLowerCase());
    if (nameTaken) {
      Alert.alert('Name already used', 'Choose a different display name.');
      return;
    }
    if (form.fields.length === 0) {
      Alert.alert('At least one field required', 'Add at least one field to this parameter type.');
      return;
    }
    for (const f of form.fields) {
      if (!f.label.trim()) {
        Alert.alert('Field label required', 'Every field needs a label.');
        return;
      }
      if (f.dataType === 'enum' && parseOptions(f.optionsText).length < 2) {
        Alert.alert('Choice list needs options', `"${f.label}" needs at least 2 choices.`);
        return;
      }
      if (f.dataType === 'numeric' && f.min !== '' && f.max !== '' && Number(f.min) >= Number(f.max)) {
        Alert.alert('Invalid range', `"${f.label}"'s minimum must be less than its maximum.`);
        return;
      }
    }

    const usedKeys: string[] = [];
    const field_definitions: FieldDefinition[] = form.fields.map(f => {
      const key = f.key ?? slugifyFieldKey(f.label, usedKeys);
      usedKeys.push(key);
      const def: FieldDefinition = { key, label: f.label.trim(), dataType: f.dataType, required: f.required };
      if (f.dataType === 'numeric') {
        if (f.unit.trim()) def.unit = f.unit.trim();
        if (f.min !== '') def.min = Number(f.min);
        if (f.max !== '') def.max = Number(f.max);
      }
      if (f.dataType === 'enum') {
        def.options = parseOptions(f.optionsText);
      }
      return def;
    });

    try {
      if (form.id) {
        await updateParameterType({ id: form.id, display_name: name, is_builtin: 0, field_definitions });
      } else {
        await insertParameterType({ display_name: name, field_definitions });
      }
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
      return;
    }
    setModalOpen(false);
    refresh();
  };

  const remove = async (pt: ParameterType) => {
    const count = await countReadingsForParameterType(pt.id);
    if (count > 0) {
      Alert.alert(
        "Can't delete",
        `${count} reading${count === 1 ? '' : 's'} use "${pt.display_name}". Delete ${count === 1 ? 'it' : 'them'} first, then try again.`
      );
      return;
    }
    Alert.alert('Delete parameter type', `Delete "${pt.display_name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteParameterType(pt.id); refresh(); } }
    ]);
  };

  const divider = { borderBottomWidth: 1, borderBottomColor: colors.border };

  return (
    <Screen>
      <Text style={typography.h1}>Parameter Types</Text>

      <FlatList
        style={{ marginTop: spacing.lg }}
        data={types}
        keyExtractor={t => t.id}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={typography.bodyBold}>{item.display_name}</Text>
              <Text style={typography.caption}>
                {item.is_builtin ? 'Built-in' : 'Custom'} · {item.field_definitions.length} field{item.field_definitions.length === 1 ? '' : 's'}
              </Text>
            </View>
            {!item.is_builtin && (
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button label="Edit" size="sm" variant="secondary" onPress={() => openEdit(item)} />
                <Button label="Delete" size="sm" variant="destructive" onPress={() => remove(item)} />
              </View>
            )}
          </Card>
        )}
        ListEmptyComponent={() => <EmptyState title="No parameter types yet" />}
      />

      <Button label="Add Parameter Type" onPress={openAdd} style={{ marginTop: spacing.lg }} />

      <Modal visible={modalOpen} animationType="slide">
        <Screen scroll>
          <Text style={typography.h1}>{form.id ? 'Edit Parameter Type' : 'New Parameter Type'}</Text>

          <Text style={[typography.bodyBold, styles.label]}>Display Name</Text>
          <TextInput
            placeholder="e.g. Weight"
            value={form.display_name}
            onChangeText={t => setForm(f => ({ ...f, display_name: t }))}
            style={styles.input}
          />

          <Text style={[typography.bodyBold, styles.label]}>Fields</Text>
          {form.fields.map((field, idx) => (
            <Card key={field.localId} style={styles.fieldCard}>
              <View style={styles.fieldCardHeader}>
                <Text style={typography.caption}>Field {idx + 1}</Text>
                {form.fields.length > 1 && (
                  <TouchableOpacity onPress={() => removeField(idx)} accessibilityLabel={`Remove field ${idx + 1}`}>
                    <Text style={{ color: colors.danger, fontWeight: '700' }}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                placeholder="Label (e.g. Weight)"
                value={field.label}
                onChangeText={t => updateFieldRow(idx, { label: t })}
                style={styles.input}
              />

              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' }}>
                {(['numeric', 'text', 'enum'] as FieldDataType[]).map(dt => (
                  <TouchableOpacity
                    key={dt}
                    onPress={() => updateFieldRow(idx, { dataType: dt })}
                    style={[styles.chip, field.dataType === dt && styles.chipActive]}
                  >
                    <Text style={{ color: field.dataType === dt ? colors.primaryDark : colors.primary }}>
                      {dt === 'numeric' ? 'Numeric' : dt === 'text' ? 'Text' : 'Choice List'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {field.dataType === 'numeric' && (
                <>
                  <TextInput
                    placeholder="Unit (optional, e.g. kg)"
                    value={field.unit}
                    onChangeText={t => updateFieldRow(idx, { unit: t })}
                    style={styles.input}
                  />
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <TextInput
                      placeholder="Min (optional)"
                      keyboardType="numeric"
                      value={field.min}
                      onChangeText={t => updateFieldRow(idx, { min: t })}
                      style={[styles.input, { flex: 1 }]}
                    />
                    <TextInput
                      placeholder="Max (optional)"
                      keyboardType="numeric"
                      value={field.max}
                      onChangeText={t => updateFieldRow(idx, { max: t })}
                      style={[styles.input, { flex: 1 }]}
                    />
                  </View>
                </>
              )}

              {field.dataType === 'enum' && (
                <TextInput
                  placeholder="Choices, comma-separated (e.g. Fasting, After Meal)"
                  value={field.optionsText}
                  onChangeText={t => updateFieldRow(idx, { optionsText: t })}
                  style={styles.input}
                />
              )}

              <TouchableOpacity
                onPress={() => updateFieldRow(idx, { required: !field.required })}
                style={[styles.chip, field.required && styles.chipActive, { alignSelf: 'flex-start', marginTop: spacing.sm }]}
              >
                <Text style={{ color: field.required ? colors.primaryDark : colors.primary }}>
                  {field.required ? 'Required' : 'Optional'}
                </Text>
              </TouchableOpacity>
            </Card>
          ))}

          <Button label="+ Add Field" variant="secondary" onPress={addField} style={{ marginTop: spacing.sm }} />

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
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surface, marginTop: spacing.sm },
  fieldCard: { marginTop: spacing.sm },
  fieldCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  chip: { padding: spacing.sm, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.pill },
  chipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primaryMuted }
});
