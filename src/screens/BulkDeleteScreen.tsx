import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useProfile } from '../services/profileContext';
import { fetchParameterTypes } from '../services/parameterRegistry';
import { fetchReadingsMatchingFilter, deleteReadingsMatchingFilter, BulkDeleteFilter } from '../services/readingService';
import { diaryColumnFields, startOfDay, endOfDay, startOfThisWeek, startOfThisMonth, startOfThisYear } from '../services/utils';
import { ParameterType, Reading } from '../types';
import { Screen, Card, Button, Banner, SegmentedControl, EmptyState } from '../theme/components';
import { colors, spacing, typography, radius } from '../theme/tokens';

type DatePreset = 'week' | 'month' | 'year' | '7' | '30' | 'all';

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: '7', label: 'Last 7 Days' },
  { key: '30', label: 'Last 30 Days' },
  { key: 'all', label: 'All Time' }
];

// Shown up front (before the confirm Alert) so the row count doesn't have to be
// rendered again inline in the sentence, and to leave headroom for very large matches
// without an unbounded page-long preview list.
const PREVIEW_LIMIT = 100;

function describeBulkDeleteFilter(opts: { count: number; profileName: string; typeName: string | null; from: Date | null; to: Date | null }): string {
  const { count, profileName, typeName, from, to } = opts;
  const noun = `${count} ${typeName ? `${typeName} ` : ''}reading${count === 1 ? '' : 's'}`;
  let dateClause = '';
  if (from && to) dateClause = ` from ${from.toLocaleDateString()} to ${to.toLocaleDateString()}`;
  else if (from) dateClause = ` from ${from.toLocaleDateString()} onward`;
  else if (to) dateClause = ` through ${to.toLocaleDateString()}`;
  return `Delete ${noun}${dateClause} for ${profileName}? This cannot be undone.`;
}

export default function BulkDeleteScreen() {
  const { profiles, activeProfile } = useProfile();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [types, setTypes] = useState<ParameterType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null); // null = All Types
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [matches, setMatches] = useState<Reading[]>([]);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!selectedProfileId && activeProfile) setSelectedProfileId(activeProfile.id);
  }, [activeProfile, selectedProfileId]);

  useEffect(() => {
    fetchParameterTypes().then(setTypes);
  }, []);

  const refreshMatches = () => {
    if (!selectedProfileId) {
      setMatches([]);
      return;
    }
    const filter: BulkDeleteFilter = { parameterTypeId: selectedTypeId, from, to };
    fetchReadingsMatchingFilter(selectedProfileId, filter).then(setMatches);
  };

  useEffect(refreshMatches, [selectedProfileId, selectedTypeId, from, to]);

  const applyPreset = (preset: DatePreset) => {
    const now = new Date();
    if (preset === 'week') {
      setFrom(startOfThisWeek(now));
      setTo(endOfDay(now));
    } else if (preset === 'month') {
      setFrom(startOfThisMonth(now));
      setTo(endOfDay(now));
    } else if (preset === 'year') {
      setFrom(startOfThisYear(now));
      setTo(endOfDay(now));
    } else if (preset === '7' || preset === '30') {
      const d = new Date(now);
      d.setDate(d.getDate() - (preset === '7' ? 7 : 30));
      setFrom(startOfDay(d));
      setTo(endOfDay(now));
    } else {
      setFrom(null);
      setTo(null);
    }
  };

  const handleDelete = () => {
    if (matches.length === 0 || !selectedProfileId) return;
    const profileName = profiles.find(p => p.id === selectedProfileId)?.name ?? 'this profile';
    const typeName = selectedTypeId ? types.find(t => t.id === selectedTypeId)?.display_name ?? null : null;
    const message = describeBulkDeleteFilter({ count: matches.length, profileName, typeName, from, to });

    Alert.alert('Delete readings', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            const count = await deleteReadingsMatchingFilter(selectedProfileId, { parameterTypeId: selectedTypeId, from, to });
            Alert.alert('Deleted', `${count} reading${count === 1 ? '' : 's'} deleted.`);
            setPreviewExpanded(false);
            refreshMatches();
          } finally {
            setDeleting(false);
          }
        }
      }
    ]);
  };

  if (!activeProfile) {
    return (
      <Screen>
        <Text style={typography.h1}>Delete Multiple Readings</Text>
        <EmptyState title="No profile yet" subtitle="Add a profile to get started." />
      </Screen>
    );
  }

  const previewRows = matches.slice(0, PREVIEW_LIMIT);

  return (
    <Screen scroll>
      <Text style={typography.h1}>Delete Multiple Readings</Text>
      <Banner
        variant="info"
        message="Deleted readings can't be recovered from within the app — only from your last on-device backup (if you have one), until your next backup runs."
      />

      {profiles.length > 1 && (
        <View style={{ marginTop: spacing.md }}>
          <Text style={[typography.bodyBold, styles.label]}>Profile</Text>
          <SegmentedControl
            options={profiles.map(p => ({ key: p.id, label: p.name }))}
            value={selectedProfileId ?? ''}
            onChange={setSelectedProfileId}
          />
        </View>
      )}

      <Text style={[typography.bodyBold, styles.label]}>Parameter</Text>
      <View style={styles.chipRow}>
        <TouchableOpacity onPress={() => setSelectedTypeId(null)} style={[styles.chip, selectedTypeId === null && styles.chipActive]}>
          <Text style={{ color: selectedTypeId === null ? colors.primaryDark : colors.primary }}>All Types</Text>
        </TouchableOpacity>
        {types.map(t => (
          <TouchableOpacity key={t.id} onPress={() => setSelectedTypeId(t.id)} style={[styles.chip, selectedTypeId === t.id && styles.chipActive]}>
            <Text style={{ color: selectedTypeId === t.id ? colors.primaryDark : colors.primary }}>{t.display_name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[typography.bodyBold, styles.label]}>Date Range</Text>
      <View style={styles.chipRow}>
        {DATE_PRESETS.map(p => (
          <TouchableOpacity key={p.key} onPress={() => applyPreset(p.key)} style={styles.chip}>
            <Text style={{ color: colors.primary }}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
        <TouchableOpacity style={[styles.dateField, { flex: 1 }]} onPress={() => setShowFromPicker(true)}>
          <Text style={typography.caption}>From</Text>
          <Text style={typography.bodyBold}>{from ? from.toLocaleDateString() : 'Any date'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.dateField, { flex: 1 }]} onPress={() => setShowToPicker(true)}>
          <Text style={typography.caption}>To</Text>
          <Text style={typography.bodyBold}>{to ? to.toLocaleDateString() : 'Any date'}</Text>
        </TouchableOpacity>
      </View>

      {showFromPicker && (
        <DateTimePicker
          value={from ?? new Date()}
          mode="date"
          maximumDate={new Date()}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onValueChange={(_, d) => {
            setShowFromPicker(false);
            if (d) setFrom(startOfDay(d));
          }}
          onDismiss={() => setShowFromPicker(false)}
        />
      )}
      {showToPicker && (
        <DateTimePicker
          value={to ?? new Date()}
          mode="date"
          maximumDate={new Date()}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onValueChange={(_, d) => {
            setShowToPicker(false);
            if (d) setTo(endOfDay(d));
          }}
          onDismiss={() => setShowToPicker(false)}
        />
      )}

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={typography.bodyBold}>
          {matches.length} reading{matches.length === 1 ? '' : 's'} {matches.length === 1 ? 'matches' : 'match'} these filters
        </Text>
        {matches.length > 0 && (
          <TouchableOpacity onPress={() => setPreviewExpanded(e => !e)}>
            <Text style={{ color: colors.primary, marginTop: spacing.sm }}>{previewExpanded ? 'Hide preview' : 'Show preview'}</Text>
          </TouchableOpacity>
        )}
      </Card>

      {previewExpanded && (
        <Card style={{ marginTop: spacing.sm, padding: 0 }}>
          {previewRows.map((r, i) => {
            const typeDef = types.find(t => t.id === r.parameter_type_id);
            const cols = diaryColumnFields(typeDef);
            const summary = cols.map(f => `${f.label}: ${r.vals[f.key] ?? '—'}`).join(', ');
            return (
              <View key={r.id} style={[styles.previewRow, i > 0 && styles.previewRowDivider]}>
                <Text style={typography.caption}>
                  {new Date(r.recorded_at).toLocaleDateString()} · {typeDef?.display_name ?? r.parameter_type_id}
                </Text>
                <Text style={typography.body}>{summary || '—'}</Text>
              </View>
            );
          })}
          {matches.length > PREVIEW_LIMIT && (
            <Text style={[typography.caption, { padding: spacing.md }]}>...and {matches.length - PREVIEW_LIMIT} more</Text>
          )}
        </Card>
      )}

      <Button
        label={deleting ? 'Deleting…' : 'Delete Matching Readings'}
        variant="destructive"
        onPress={handleDelete}
        disabled={matches.length === 0 || deleting}
        style={{ marginTop: spacing.lg }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: spacing.lg, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { padding: spacing.sm, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.pill },
  chipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primaryMuted },
  dateField: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surface },
  previewRow: { padding: spacing.md },
  previewRowDivider: { borderTopWidth: 1, borderTopColor: colors.border }
});
