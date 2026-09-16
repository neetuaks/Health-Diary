import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useProfile } from '../services/profileContext';
import { fetchReadingsForProfile } from '../services/readingService';
import { fetchParameterTypes } from '../services/parameterRegistry';
import { VictoryChart, VictoryLine, VictoryArea, VictoryAxis, VictoryLegend } from 'victory-native';
import { filterByRange, rangeStart, RangeKey, classifyBP, classifyGlucose, clinicalColorKey } from '../services/utils';
import { Screen, Card, EmptyState } from '../theme/components';
import { colors, spacing, typography, radius } from '../theme/tokens';

const SERIES_COLORS = [colors.primary, colors.secondary, colors.warning];

function referenceBands(typeId: string, x0: Date, x1: Date) {
  const zones = typeId === 'bp'
    ? [
        { y0: 0, y: 120, color: colors.successBg },
        { y0: 120, y: 140, color: colors.warningBg },
        { y0: 140, y: 220, color: colors.dangerBg },
      ]
    : typeId === 'glucose'
    ? [
        { y0: 0, y: 70, color: colors.dangerBg },
        { y0: 70, y: 140, color: colors.successBg },
        { y0: 140, y: 180, color: colors.warningBg },
        { y0: 180, y: 400, color: colors.dangerBg },
      ]
    : [];
  return zones.map(z => ({ ...z, data: [{ x: x0, y0: z.y0, y: z.y }, { x: x1, y0: z.y0, y: z.y }] }));
}

export default function ChartScreen() {
  const { activeProfile } = useProfile();
  const [readings, setReadings] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('7');

  useEffect(() => { fetchParameterTypes().then(setTypes); }, []);
  useEffect(() => {
    if (!activeProfile) return;
    fetchReadingsForProfile(activeProfile.id).then(rs => setReadings(rs));
  }, [activeProfile]);

  const filtered = selectedType ? filterByRange(readings.filter(r => r.parameter_type_id === selectedType), range) : [];
  const series = (key: string) => filtered.map(r => ({ x: new Date(r.recorded_at), y: Number(r.vals[key]) })).filter(p => !isNaN(p.y));
  const typeDef = types.find(t => t.id === selectedType);
  const numericFields = typeDef ? typeDef.field_definitions.filter((f: any) => f.dataType === 'numeric') : [];

  const avgOf = (key: string) => {
    const vals = filtered.map(r => Number(r.vals[key])).filter(v => !isNaN(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const bpAvgClassification = selectedType === 'bp' && avgOf('systolic') !== null && avgOf('diastolic') !== null
    ? classifyBP(avgOf('systolic')!, avgOf('diastolic')!)
    : null;

  return (
    <Screen scroll>
      <Text style={typography.h1}>Charts</Text>
      <View style={{ flexDirection: 'row', marginTop: spacing.md, flexWrap: 'wrap', gap: spacing.sm }}>
        {types.map(t => (
          <TouchableOpacity key={t.id} onPress={() => setSelectedType(t.id)} style={[styles.chip, selectedType === t.id && styles.chipActive]}>
            <Text style={{ color: selectedType === t.id ? colors.textOnPrimary : colors.primary, fontWeight: '600' }}>{t.display_name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flexDirection: 'row', marginTop: spacing.md, flexWrap: 'wrap', gap: spacing.sm }}>
        {(['today', 'yesterday', '7', '30'] as RangeKey[]).map(rk => (
          <TouchableOpacity key={rk} onPress={() => setRange(rk)} style={[styles.chip, range === rk && styles.chipActive]}>
            <Text style={{ color: range === rk ? colors.textOnPrimary : colors.primary }}>{rk === '7' ? 'Last 7 Days' : rk === '30' ? 'Last 30 Days' : rk === 'today' ? 'Today' : 'Yesterday'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedType && (
        <View style={{ marginTop: spacing.lg }}>
          {filtered.length === 0 ? (
            <EmptyState title="No readings in this range" subtitle="Log a reading or pick a wider range." />
          ) : (
            <>
              <VictoryChart>
                {referenceBands(selectedType, rangeStart(range), new Date()).map((band, i) => (
                  <VictoryArea key={`band-${i}`} data={band.data} style={{ data: { fill: band.color } }} />
                ))}
                {numericFields.map((f: any, idx: number) => (
                  <VictoryLine key={f.key} data={series(f.key)} interpolation="monotoneX" style={{ data: { stroke: SERIES_COLORS[idx % SERIES_COLORS.length], strokeWidth: 2 } }} />
                ))}
                <VictoryAxis dependentAxis />
                <VictoryAxis fixLabelOverlap />
              </VictoryChart>
              {numericFields.length > 1 && (
                <VictoryLegend
                  orientation="horizontal"
                  gutter={spacing.md}
                  data={numericFields.map((f: any, idx: number) => ({ name: f.label, symbol: { fill: SERIES_COLORS[idx % SERIES_COLORS.length] } }))}
                />
              )}
            </>
          )}

          <View style={{ marginTop: spacing.lg }}>
            <Text style={typography.h2}>Summary</Text>
            {bpAvgClassification && (
              <View style={[styles.badge, { backgroundColor: colors[`${clinicalColorKey(bpAvgClassification)}Bg` as 'successBg' | 'warningBg' | 'dangerBg'] }]}>
                <Text style={{ color: colors[clinicalColorKey(bpAvgClassification)], fontWeight: '700' }}>
                  Average: {bpAvgClassification === 'hypertensive-crisis' ? 'Hypertensive crisis' : bpAvgClassification[0].toUpperCase() + bpAvgClassification.slice(1)}
                </Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
              {numericFields.map((f: any) => {
                const vals = filtered.map(r => Number(r.vals[f.key])).filter(v => !isNaN(v));
                if (vals.length === 0) return (
                  <Card key={f.key} style={styles.statCard}><Text style={typography.caption}>{f.label}: no data</Text></Card>
                );
                const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
                const min = Math.min(...vals);
                const max = Math.max(...vals);
                const glucoseClass = selectedType === 'glucose' && f.key === 'value' ? classifyGlucose(avg) : null;
                return (
                  <Card key={f.key} style={styles.statCard}>
                    <Text style={typography.caption}>{f.label}</Text>
                    <Text style={[typography.numberLarge, glucoseClass ? { color: colors[clinicalColorKey(glucoseClass)] } : null]}>{avg.toFixed(1)}</Text>
                    <Text style={typography.caption}>min {min} · max {max} · {vals.length} readings</Text>
                  </Card>
                );
              })}
            </View>
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: { padding: spacing.sm, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md },
  chipActive: { backgroundColor: colors.primary },
  badge: { padding: spacing.sm, borderRadius: radius.md, alignSelf: 'flex-start', marginTop: spacing.sm },
  statCard: { minWidth: 140, flexGrow: 1 }
});
