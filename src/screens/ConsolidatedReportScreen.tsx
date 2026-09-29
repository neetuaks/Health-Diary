import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useProfile } from '../services/profileContext';
import { useEntitlement } from '../services/entitlement';
import { fetchReadingsForProfile } from '../services/readingService';
import { fetchParameterTypesForProfile } from '../services/profileParameterTypes';
import { generateReportPDF, generateConsolidatedReportPDF } from '../services/pdf';
import { persistAndRecordPdf } from '../services/pdfHistory';
import { downloadPdfToDevice } from '../services/pdfDownload';
import { filterByRange, filterByHistoryWindow, RangeKey } from '../services/utils';
import { ParameterType } from '../types';
import { Screen, Card, Button, SegmentedControl, EmptyState } from '../theme/components';
import { colors, spacing, typography, radius } from '../theme/tokens';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
];

function LockedUpsell({ navigation }: { navigation: any }) {
  return (
    <Screen>
      <EmptyState
        title="Consolidated Report"
        subtitle="One doctor-ready PDF covering several profiles at once. Upgrade to Premium to unlock."
      />
      <Button label="See Plans" onPress={() => navigation.navigate('Paywall')} style={{ marginTop: spacing.lg }} />
    </Screen>
  );
}

// FAMILY-FEATURES-SPEC.md §2. Premium-only — reachable only from ReportScreen's
// gated entry point, but defensively shows the same locked upsell if reached
// any other way (e.g. a stale deep link after a downgrade).
export default function ConsolidatedReportScreen() {
  const { profiles } = useProfile();
  const { limits } = useEntitlement();
  const navigation = useNavigation<any>();

  const selectableProfiles = profiles.filter(p => !p.locked_at);
  // Sensible default per spec §2.1 ("pick a sensible default") — everyone
  // pre-selected, since generating for the whole household in one tap is the
  // common case; the caregiver deselects anyone they don't want included.
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>(selectableProfiles.map(p => p.id));
  const [range, setRange] = useState<RangeKey>('30');
  const [availableParams, setAvailableParams] = useState<ParameterType[]>([]);
  const [selectedParamIds, setSelectedParamIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  // The union of parameter types any *selected* profile logs — recomputed
  // whenever the profile selection changes, newly-appearing types default to
  // included (spec: "default: all parameters each selected profile logs").
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const perProfile = await Promise.all(selectedProfileIds.map(id => fetchParameterTypesForProfile(id)));
      const byId = new Map<string, ParameterType>();
      perProfile.flat().forEach(pt => byId.set(pt.id, pt));
      const union = Array.from(byId.values());
      if (cancelled) return;
      setAvailableParams(union);
      setSelectedParamIds(prev => {
        const stillValid = prev.filter(id => byId.has(id));
        const newlyAppeared = union.filter(pt => !prev.includes(pt.id)).map(pt => pt.id);
        return [...stillValid, ...newlyAppeared];
      });
    })();
    return () => { cancelled = true; };
  }, [selectedProfileIds]);

  const toggleProfile = (id: string) => {
    setSelectedProfileIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const toggleParam = (id: string) => {
    setSelectedParamIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  if (!limits.consolidatedReport) {
    return <LockedUpsell navigation={navigation} />;
  }

  const generate = async () => {
    if (selectedProfileIds.length === 0) {
      Alert.alert('Select at least one profile', 'Choose which profiles to include in this report.');
      return;
    }
    setGenerating(true);
    try {
      const selected = selectableProfiles.filter(p => selectedProfileIds.includes(p.id));
      const perProfileReadings = await Promise.all(
        selected.map(async profile => {
          const all = await fetchReadingsForProfile(profile.id);
          const windowed = filterByHistoryWindow(all, limits.historyWindowDays);
          return { profile, readings: filterByRange(windowed, range) };
        })
      );

      const dates = perProfileReadings.flatMap(e => e.readings.map(r => new Date(r.recorded_at).getTime()));
      const dateRangeLabel = dates.length
        ? `${new Date(Math.min(...dates)).toLocaleDateString()} – ${new Date(Math.max(...dates)).toLocaleDateString()}`
        : 'No readings in range';

      // Per FAMILY-FEATURES-SPEC §2.1: a single selected profile just uses the
      // normal single report — no cover page/consolidated wrapper for one person.
      const uri = selected.length === 1
        ? await generateReportPDF(perProfileReadings[0].profile, perProfileReadings[0].readings, selectedParamIds, range)
        : await generateConsolidatedReportPDF(
            perProfileReadings.map(e => ({ profile: e.profile, readings: e.readings, parameterFilter: selectedParamIds })),
            range
          );

      const record = await persistAndRecordPdf(uri, {
        profileIds: selectedProfileIds,
        dateRange: dateRangeLabel,
        type: selected.length === 1 ? 'single' : 'consolidated',
      });
      const result = await downloadPdfToDevice(record.file_path, 'healthdiary_family_report.pdf');
      if (!result.success) Alert.alert('Could not save', result.message ?? 'Please try again.');
      else navigation.goBack();
    } catch (e: any) {
      Alert.alert('Report failed', e?.message ?? 'Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={typography.h1}>Consolidated Report</Text>
      <Text style={[typography.caption, { marginTop: spacing.xs }]}>
        One PDF covering the profiles you choose — each gets its own clearly separated section.
      </Text>

      <Text style={[typography.bodyBold, styles.sectionLabel]}>Profiles</Text>
      {selectableProfiles.length === 0 ? (
        <EmptyState title="No profiles yet" />
      ) : (
        <View style={styles.chipRow}>
          {selectableProfiles.map(p => (
            <TouchableOpacity
              key={p.id}
              onPress={() => toggleProfile(p.id)}
              style={[styles.chip, selectedProfileIds.includes(p.id) && styles.chipActive]}
            >
              <Text style={{ color: selectedProfileIds.includes(p.id) ? colors.primaryDark : colors.primary }}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={[typography.bodyBold, styles.sectionLabel]}>Date range</Text>
      <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />

      {availableParams.length > 0 && (
        <>
          <Text style={[typography.bodyBold, styles.sectionLabel]}>Parameters to include</Text>
          <View style={styles.chipRow}>
            {availableParams.map(pt => (
              <TouchableOpacity
                key={pt.id}
                onPress={() => toggleParam(pt.id)}
                style={[styles.chip, selectedParamIds.includes(pt.id) && styles.chipActive]}
              >
                <Text style={{ color: selectedParamIds.includes(pt.id) ? colors.primaryDark : colors.primary }}>{pt.display_name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <Button
        label={generating ? 'Generating…' : 'Generate & Download'}
        onPress={generate}
        disabled={generating || selectedProfileIds.length === 0}
        style={{ marginTop: spacing.xl }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: { padding: spacing.sm, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.pill },
  chipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primaryMuted },
});
