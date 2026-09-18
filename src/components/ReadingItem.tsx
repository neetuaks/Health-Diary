import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Reading, ParameterType } from '../types';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { fieldClassification, clinicalColorKey, diaryColumnFields } from '../services/utils';
import { colors, spacing, radius } from '../theme/tokens';

type Props = {
  reading: Reading;
  parameterType?: ParameterType;
  onDelete: (id: string) => void;
  onPress?: () => void;
  // The reading's profile's age (from ageInMonthsFromDOB) — drives Pulse's
  // age-banded thresholds; omitted, Pulse falls back to the Adult band.
  ageInMonths?: number | null;
};

const DATE_COL_WIDTH = 60;

// Renders one aligned table row (Date | each column field) for the Diary list — the
// columns come from diaryColumnFields (numeric fields, plus any field explicitly
// opted in via showInList) rather than `Object.entries(reading.vals)`, since a
// reading with an untouched optional field (e.g. Pulse left blank) simply omits
// that key, which would otherwise misalign columns across rows in the same table.
export default function ReadingItem({ reading, parameterType, onDelete, onPress, ageInMonths }: Props) {
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

  const columnFields = diaryColumnFields(parameterType);

  const dateObj = new Date(reading.recorded_at);
  const dayLabel = dateObj.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const timeLabel = dateObj.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <Swipeable renderRightActions={rightActions}>
      <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.dateBadge}>
          <Text style={styles.dateDay}>{dayLabel}</Text>
          <Text style={styles.dateTime}>{timeLabel}</Text>
        </View>
        <View style={styles.valuesRow}>
          {columnFields.map(f => {
            const raw = reading.vals[f.key];
            const hasValue = raw !== undefined && raw !== null && raw !== '';

            if (f.dataType !== 'numeric') {
              const label = hasValue ? (f.optionShortLabels?.[raw] ?? f.optionLabels?.[raw] ?? String(raw)) : '—';
              return (
                <View key={f.key} style={styles.valueCell}>
                  <Text style={styles.tagText} numberOfLines={1}>{label}</Text>
                </View>
              );
            }

            const clinical = hasValue ? fieldClassification(reading.parameter_type_id, f.key, reading.vals, ageInMonths ?? undefined) : null;
            const tint = clinical ? colors[clinicalColorKey(clinical)] : colors.text;
            return (
              <View key={f.key} style={styles.valueCell}>
                <Text style={[styles.valueNumber, { color: tint }]} numberOfLines={1}>
                  {hasValue ? String(raw) : '—'}
                </Text>
              </View>
            );
          })}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateBadge: { width: DATE_COL_WIDTH, borderRadius: radius.md, backgroundColor: colors.primaryMuted, alignItems: 'center', paddingVertical: spacing.xs },
  dateDay: { fontSize: 12, fontWeight: '700', color: colors.primaryDark, textAlign: 'center' },
  dateTime: { fontSize: 10, color: colors.primaryDark, opacity: 0.75, marginTop: 1, textAlign: 'center' },
  valuesRow: { flex: 1, flexDirection: 'row', marginLeft: spacing.md },
  valueCell: { flex: 1, alignItems: 'center' },
  valueNumber: { fontSize: 18, fontWeight: '700' },
  // Non-clinical tag (e.g. Glucose's Fasting/OGTT) — visually distinct (small, muted
  // pill) from the big bold clinical-colored numbers so it doesn't read as a value.
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  deleteButton: { backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl }
});
