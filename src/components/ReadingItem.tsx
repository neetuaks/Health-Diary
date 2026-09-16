import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Reading } from '../types';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { classifyBP, classifyGlucose, clinicalColorKey } from '../services/utils';
import { colors, spacing, radius, typography } from '../theme/tokens';

type Props = {
  reading: Reading;
  parameterDisplayName?: string;
  onDelete: (id: string) => void;
  onPress?: () => void;
};

function classification(reading: Reading) {
  const v = reading.vals || {};
  if (v.systolic !== undefined && v.diastolic !== undefined) return classifyBP(Number(v.systolic), Number(v.diastolic));
  if (reading.parameter_type_id === 'glucose' && v.value !== undefined) return classifyGlucose(Number(v.value));
  return null;
}

export default function ReadingItem({ reading, parameterDisplayName, onDelete, onPress }: Props) {
  const rightActions = () => (
    <TouchableOpacity style={styles.deleteButton} onPress={() => {
      Alert.alert('Delete', 'Delete this reading?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(reading.id) }
      ]);
    }}>
      <Text style={{ color: colors.textOnPrimary, fontWeight: '600' }}>Delete</Text>
    </TouchableOpacity>
  );

  const primaryText = parameterDisplayName ?? reading.parameter_type_id;
  const valuesText = Object.entries(reading.vals).map(([k, v]) => `${k}: ${v}`).join('  ');
  const clinical = classification(reading);
  const accentColor = clinical ? colors[clinicalColorKey(clinical)] : colors.border;

  return (
    <Swipeable renderRightActions={rightActions}>
      <TouchableOpacity style={[styles.container, { borderLeftColor: accentColor }]} onPress={onPress}>
        <View>
          <Text style={typography.bodyBold}>{primaryText}</Text>
          <Text style={typography.caption}>{new Date(reading.recorded_at).toLocaleString()}</Text>
        </View>
        <View>
          <Text style={[styles.values, clinical ? { color: colors[clinicalColorKey(clinical)] } : null]}>{valuesText}</Text>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderLeftWidth: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  values: { textAlign: 'right', color: colors.text, fontWeight: '600' },
  deleteButton: { backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, borderRadius: radius.sm }
});
