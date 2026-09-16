import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useProfile } from '../services/profileContext';
import { fetchReadingsForProfile } from '../services/readingService';
import { fetchParameterTypes } from '../services/parameterRegistry';
import { generateReportPDF } from '../services/pdf';
import { filterByRange, RangeKey } from '../services/utils';
import { Screen, Button, Card } from '../theme/components';
import { colors, spacing, typography, radius } from '../theme/tokens';

export default function ReportScreen() {
  const { activeProfile } = useProfile();
  const [readings, setReadings] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [filter, setFilter] = useState<string[]>([]);
  const [range, setRange] = useState<RangeKey>('30');

  useEffect(() => { fetchParameterTypes().then(setTypes); }, []);
  useEffect(() => { if (activeProfile) fetchReadingsForProfile(activeProfile.id).then(setReadings); }, [activeProfile]);

  const handleGenerate = async () => {
    if (!activeProfile) return;
    const filteredByRange = filterByRange(readings, range);
    await generateReportPDF(activeProfile, filteredByRange, filter);
  };

  const rangeInScope = filterByRange(readings, range).length;

  return (
    <Screen>
      <Text style={typography.h1}>Reports</Text>

      <Text style={[typography.bodyBold, styles.sectionLabel]}>Date range</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {(['today', 'yesterday', '7', '30'] as RangeKey[]).map(rk => (
          <TouchableOpacity key={rk} onPress={() => setRange(rk)} style={[styles.chip, range === rk && styles.chipActive]}>
            <Text style={{ color: range === rk ? colors.textOnPrimary : colors.primary }}>{rk === '7' ? 'Last 7 Days' : rk === '30' ? 'Last 30 Days' : rk === 'today' ? 'Today' : 'Yesterday'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[typography.bodyBold, styles.sectionLabel]}>Parameters</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {types.map(t => (
          <TouchableOpacity key={t.id} onPress={() => setFilter(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])} style={[styles.chip, filter.includes(t.id) && styles.chipActive]}>
            <Text style={{ color: filter.includes(t.id) ? colors.textOnPrimary : colors.primary }}>{t.display_name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[typography.caption, { marginTop: spacing.sm }]}>Leave parameters unselected to include all types.</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={typography.bodyBold}>{activeProfile?.name ?? 'No profile'}</Text>
        <Text style={typography.caption}>{rangeInScope} reading{rangeInScope === 1 ? '' : 's'} in the selected range</Text>
      </Card>

      <Button label="Generate & Share PDF" onPress={handleGenerate} style={{ marginTop: spacing.lg }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.sm },
  chip: { padding: spacing.sm, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md },
  chipActive: { backgroundColor: colors.primary }
});
