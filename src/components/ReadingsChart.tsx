import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { VictoryChart, VictoryLine, VictoryScatter, VictoryAxis, VictoryLegend } from 'victory-native';
import { ParameterType } from '../types';
import {
  RangeKey,
  fieldClassification,
  clinicalColorKey,
  yAxisConfigFor,
  buildChartSeriesList,
  computeChartXDomain,
} from '../services/utils';
import { EmptyState } from '../theme/components';
import { colors, spacing, chartSeriesColors } from '../theme/tokens';

const SERIES_COLORS: readonly string[] = chartSeriesColors;

// Shared by ChartScreen and ReportScreen (and mirrored, necessarily by hand since
// expo-print renders static HTML rather than React Native views, in pdf.ts's SVG
// chart) so all three always draw the same axes/series/legend from the same data.
export default function ReadingsChart({
  readings,
  typeDef,
  range,
  ageInMonths,
  height = 320,
}: {
  readings: any[];
  typeDef: ParameterType | null | undefined;
  range: RangeKey;
  ageInMonths?: number;
  height?: number;
}) {
  const { width: windowWidth } = useWindowDimensions();

  if (!typeDef) return null;

  if (readings.length === 0) {
    return <EmptyState title="No readings in this range" subtitle="Log a reading or pick a wider range." />;
  }

  const chartSeriesList = buildChartSeriesList(typeDef, readings);
  const { x0, x1, tickCount: xTickCount } = computeChartXDomain(readings, range);
  const yAxis = yAxisConfigFor(typeDef.id);

  const seriesFor = (items: any[], key: string) =>
    items.map(r => ({ x: new Date(r.recorded_at), y: Number(r.vals[key]) })).filter(p => !isNaN(p.y));

  // Per-point classification drives the scatter dot color — this is the chart's
  // only clinical-severity coloring. A shared background band can't work here: BP
  // plots Systolic and Diastolic on the same Y-axis, but they have different
  // clinical thresholds, so one band would misrepresent whichever series it wasn't
  // scaled for. Per-point color has no such ambiguity.
  const scatterSeriesFor = (items: any[], key: string, fallbackColor: string) =>
    items
      .map(r => {
        const y = Number(r.vals[key]);
        if (isNaN(y)) return null;
        const cls = fieldClassification(typeDef.id, key, r.vals, ageInMonths);
        return { x: new Date(r.recorded_at), y, fill: cls ? colors[clinicalColorKey(cls)] : fallbackColor };
      })
      .filter((p): p is { x: Date; y: number; fill: string } => p !== null);

  return (
    <View>
      <VictoryChart
        height={height}
        scale={{ x: 'time' }}
        domain={{ x: [x0, x1], ...(yAxis ? { y: yAxis.domain } : {}) }}
        domainPadding={{ x: 20, y: yAxis ? 0 : 20 }}
        // VictoryChart's default padding is 50px on every side regardless of
        // content — with a compact chart height that reserved a large blank
        // margin below the x-axis before whatever followed the chart. This tight,
        // axis-label-sized padding matches the PDF chart's own SVG margins too.
        padding={{ top: 16, bottom: 36, left: 46, right: 16 }}
      >
        {chartSeriesList.map((s, idx) => {
          const seriesColor = SERIES_COLORS[idx % SERIES_COLORS.length];
          return (
            <VictoryLine
              key={s.id}
              data={seriesFor(s.readings, s.fieldKey)}
              interpolation="monotoneX"
              style={{ data: { stroke: seriesColor, strokeWidth: 2 } }}
            />
          );
        })}
        {chartSeriesList.map((s, idx) => {
          const seriesColor = SERIES_COLORS[idx % SERIES_COLORS.length];
          return (
            <VictoryScatter
              key={`dots-${s.id}`}
              data={scatterSeriesFor(s.readings, s.fieldKey, seriesColor)}
              size={4}
              style={{ data: { fill: ({ datum }: any) => datum.fill } }}
            />
          );
        })}
        <VictoryAxis
          dependentAxis
          tickValues={yAxis?.tickValues}
          style={{
            grid: { stroke: colors.border, strokeWidth: 1 },
            tickLabels: { fontSize: 10 },
            axis: { stroke: colors.border },
          }}
        />
        <VictoryAxis
          fixLabelOverlap
          tickCount={xTickCount}
          tickFormat={(t: any) => {
            const d = new Date(t);
            return range === 'today' || range === 'yesterday'
              ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
              : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          }}
          style={{ tickLabels: { fontSize: 10, padding: 5 } }}
        />
      </VictoryChart>
      {chartSeriesList.length > 1 && (
        <VictoryLegend
          orientation="horizontal"
          gutter={spacing.md}
          // VictoryLegend defaults to a reserved 450x300 box when width/height
          // aren't set, regardless of how little the actual legend row needs —
          // that unused ~300px was the real source of the large gap users saw
          // between the chart and whatever followed it.
          width={windowWidth - spacing.lg * 2}
          height={36}
          data={chartSeriesList.map((s, idx) => ({ name: s.label, symbol: { fill: SERIES_COLORS[idx % SERIES_COLORS.length] } }))}
        />
      )}
    </View>
  );
}
