import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useProfile } from '../services/profileContext';
import { fetchReadingsForProfile } from '../services/readingService';
import { fetchParameterTypes } from '../services/parameterRegistry';
import ReadingsChart from '../components/ReadingsChart';
import { filterByRange, RangeKey, ageInMonthsFromDOB } from '../services/utils';
import { Screen, SegmentedControl, EmptyState } from '../theme/components';
import { spacing } from '../theme/tokens';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
];

export default function ChartScreen() {
  const { activeProfile } = useProfile();
  const { height: windowHeight } = useWindowDimensions();
  const [readings, setReadings] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('7');

  useEffect(() => { fetchParameterTypes().then(setTypes); }, []);

  // Refetches every time this tab is focused, not just once on mount — React
  // Navigation's bottom-tab navigator keeps every tab's screen mounted in the
  // background rather than remounting it on switch, so a plain useEffect keyed on
  // activeProfile only ran once and never picked up readings edited on the Diary
  // tab afterward (no real "cache," just stale state that nothing invalidated).
  useFocusEffect(
    useCallback(() => {
      // Clear rather than just skip the fetch when there's no active profile
      // (e.g. right after "Delete All Data") — otherwise whatever was last
      // fetched for a now-gone profile just keeps rendering.
      if (!activeProfile) { setReadings([]); return; }
      fetchReadingsForProfile(activeProfile.id).then(rs => setReadings(rs));
    }, [activeProfile])
  );

  // BP is the default tab when present, matching Diary's default.
  useEffect(() => {
    if (types.length > 0 && !selectedType) {
      const bp = types.find((t: any) => t.id === 'bp');
      setSelectedType(bp ? bp.id : types[0].id);
    }
  }, [types, selectedType]);

  const filtered = selectedType ? filterByRange(readings.filter(r => r.parameter_type_id === selectedType), range) : [];
  const ageInMonths = ageInMonthsFromDOB(activeProfile?.date_of_birth) ?? undefined;
  const typeDef = types.find((t: any) => t.id === selectedType);

  // Gives the chart itself most of the screen instead of Victory's small ~300px
  // default, now that there's no page heading or summary section competing for
  // room above/below it.
  const chartHeight = Math.max(320, windowHeight * 0.55);

  return (
    <Screen scroll topInset={false}>
      {!activeProfile ? (
        <EmptyState title="No profile yet" subtitle="Add a profile to get started." />
      ) : (
        <>
          <View style={styles.toggleRow}>
            <SegmentedControl
              options={types.map((t: any) => ({ key: t.id, label: t.display_name }))}
              value={selectedType ?? ''}
              onChange={setSelectedType}
            />
          </View>

          <View style={{ marginBottom: spacing.lg }}>
            <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />
          </View>

          {selectedType && (
            <ReadingsChart readings={filtered} typeDef={typeDef} range={range} ageInMonths={ageInMonths} height={chartHeight} />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggleRow: { marginBottom: spacing.md },
});
