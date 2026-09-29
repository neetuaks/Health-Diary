import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useProfile } from '../services/profileContext';
import { fetchReadingsForProfile } from '../services/readingService';
import { fetchParameterTypesForProfile } from '../services/profileParameterTypes';
import { useEntitlement } from '../services/entitlement';
import { showUpgradePrompt } from '../services/paywallPrompt';
import { generateReportPDF } from '../services/pdf';
import { persistAndRecordPdf } from '../services/pdfHistory';
import { downloadPdfToDevice } from '../services/pdfDownload';
import ReadingsChart from '../components/ReadingsChart';
import { filterByRange, filterByHistoryWindow, RangeKey, ageFromDOB, ageInMonthsFromDOB, fieldClassification, clinicalColorKey, formatFieldValue } from '../services/utils';
import { Screen, Card, SegmentedControl, EmptyState, Banner } from '../theme/components';
import { colors, spacing, typography, radius } from '../theme/tokens';

// Material "download" glyph (down arrow into a tray) — PAYWALL-SPEC §6 is explicit
// this is a download action, not a share one, so it gets a distinct icon from
// ShareIcon rather than reusing it.
function DownloadIcon({ size = 18, color = colors.primaryDark }: { size?: number; color?: string }) {
  return (
    <Text style={{ fontSize: size, color, lineHeight: size + 2 }}>{'⬇'}</Text>
  );
}

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
];

const COL_WIDTH = 76;

export default function ReportScreen() {
  const { activeProfile } = useProfile();
  const { limits } = useEntitlement();
  const navigation = useNavigation<any>();
  const [readings, setReadings] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('30');
  const [downloading, setDownloading] = useState(false);
  // Drives the scroll-position arrows below — same pattern as Diary: the chart +
  // table can run past one screen, and without a hint there's nothing on screen
  // suggesting there's more below.
  const [listHeight, setListHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Refetches on every focus, not just once on mount — see ChartScreen for why a
  // plain useEffect(..., [activeProfile]) goes stale on a bottom-tab navigator.
  // Parameter types are fetched here too, not in a separate mount-only effect —
  // they're profile-scoped now, so a profile switch or a parameter change made
  // elsewhere (Profiles > Parameters) needs to be picked up on focus as well.
  useFocusEffect(
    useCallback(() => {
      // Clear rather than just skip the fetch when there's no active profile
      // (e.g. right after "Delete All Data") — otherwise whatever was last
      // fetched for a now-gone profile just keeps rendering. See ChartScreen.
      if (!activeProfile) { setReadings([]); setTypes([]); setSelectedTypeId(null); return; }
      fetchReadingsForProfile(activeProfile.id).then(setReadings);
      fetchParameterTypesForProfile(activeProfile.id).then(ts => {
        setTypes(ts);
        setSelectedTypeId(prev => (prev && ts.some((t: any) => t.id === prev) ? prev : null));
      });
    }, [activeProfile])
  );

  // BP is the default tab when present, matching Diary and Chart's default.
  useEffect(() => {
    if (types.length > 0 && !selectedTypeId) {
      const bp = types.find((t: any) => t.id === 'bp');
      setSelectedTypeId(bp ? bp.id : types[0].id);
    }
  }, [types, selectedTypeId]);

  // PAYWALL-SPEC §7: Free never gets a PDF file written at all — the on-screen
  // chart/table below (already generated from the same windowed readings) IS
  // its preview. Pro/Premium generate, persist into Report History, and save
  // to a location the user owns (see pdfDownload.ts) — no in-app "Share" step.
  const handleDownload = async () => {
    if (!limits.canGeneratePdf) {
      showUpgradePrompt(navigation, 'Downloading a PDF report needs Pro or Premium. Free shows a preview of your last 7 days.');
      return;
    }
    if (!activeProfile || !selectedTypeId || sortedScoped.length === 0) return;
    setDownloading(true);
    try {
      const filteredByRange = filterByRange(windowedReadings, range);
      const uri = await generateReportPDF(activeProfile, filteredByRange, [selectedTypeId], range);
      const dates = sortedScoped.map(r => new Date(r.recorded_at).getTime());
      const dateRangeLabel = `${new Date(Math.min(...dates)).toLocaleDateString()} – ${new Date(Math.max(...dates)).toLocaleDateString()}`;
      const record = await persistAndRecordPdf(uri, { profileIds: [activeProfile.id], dateRange: dateRangeLabel, type: 'single' });
      const result = await downloadPdfToDevice(record.file_path, `healthdiary_report_${activeProfile.name}.pdf`);
      if (!result.success) Alert.alert('Could not save', result.message ?? 'Please try again.');
    } catch (e: any) {
      Alert.alert('Report failed', e?.message ?? 'Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const windowedReadings = filterByHistoryWindow(readings, limits.historyWindowDays);
  const hasOlderHiddenReadings = limits.historyWindowDays !== null && readings.length > windowedReadings.length;
  const filteredByRange = filterByRange(windowedReadings, range);
  const scoped = selectedTypeId ? filteredByRange.filter(r => r.parameter_type_id === selectedTypeId) : [];
  const sortedScoped = [...scoped].sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
  const age = activeProfile ? ageFromDOB(activeProfile.date_of_birth) : null;
  const ageInMonths = ageInMonthsFromDOB(activeProfile?.date_of_birth) ?? undefined;
  const typeDef = types.find((t: any) => t.id === selectedTypeId);
  const fields = typeDef ? typeDef.field_definitions : [];

  const canScroll = contentHeight > listHeight + 1;
  const showScrollUpHint = canScroll && scrollY > 2;
  const showScrollDownHint = canScroll && scrollY < contentHeight - listHeight - 2;

  return (
    <Screen topInset={false}>
      {hasOlderHiddenReadings && (
        <Banner
          variant="info"
          message="Showing last 7 days. See your full history with Pro."
          onPress={() => navigation.navigate('Paywall')}
        />
      )}

      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <SegmentedControl
            options={types.map((t: any) => ({ key: t.id, label: t.display_name }))}
            value={selectedTypeId ?? ''}
            onChange={setSelectedTypeId}
          />
        </View>
        {limits.canGeneratePdf && (
          <TouchableOpacity
            style={styles.shareButton}
            onPress={() => navigation.navigate('ReportHistory')}
            accessibilityLabel="Report history"
          >
            <Text style={{ fontSize: 16 }}>{'🕘'}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => {
            if (limits.consolidatedReport) navigation.navigate('ConsolidatedReport');
            else showUpgradePrompt(navigation, 'A consolidated report covering several profiles at once needs Premium.');
          }}
          accessibilityLabel="Consolidated family report"
        >
          <Text style={{ fontSize: 16 }}>{'👪'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.shareButton, (downloading || sortedScoped.length === 0) && styles.shareButtonDisabled]}
          onPress={handleDownload}
          disabled={downloading || sortedScoped.length === 0}
          accessibilityLabel="Download PDF report"
        >
          <DownloadIcon size={18} color={colors.primaryDark} />
        </TouchableOpacity>
      </View>

      {!limits.canGeneratePdf && (
        <Text style={[typography.caption, { marginBottom: spacing.sm }]}>
          Preview only — this report has a "Preview" watermark and can't be downloaded on Free.
        </Text>
      )}

      <View style={{ marginBottom: spacing.md }}>
        <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingBottom: spacing.md }}
          onLayout={e => setListHeight(e.nativeEvent.layout.height)}
          onContentSizeChange={(_, h) => setContentHeight(h)}
          onScroll={e => setScrollY(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={32}
        >
          <Card>
            <Text style={typography.bodyBold}>
              {activeProfile?.name ?? 'No profile'}{age !== null ? ` · ${age} yrs` : ''}
              {!limits.canGeneratePdf ? '  •  PREVIEW' : ''}
            </Text>
            <Text style={typography.caption}>{sortedScoped.length} reading{sortedScoped.length === 1 ? '' : 's'} in the selected range</Text>
          </Card>

          {sortedScoped.length === 0 ? (
            <View style={{ marginTop: spacing.lg }}>
              <EmptyState title="No readings in this range" subtitle="Adjust the date range above." />
            </View>
          ) : (
            <>
              <View style={{ marginTop: spacing.md }}>
                <ReadingsChart readings={sortedScoped} typeDef={typeDef} range={range} ageInMonths={ageInMonths} height={260} />
              </View>
              <Card style={{ marginTop: spacing.md, padding: spacing.md }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    <View style={styles.tableRow}>
                      <Text style={[styles.tableHeader, { width: COL_WIDTH }]}>Date</Text>
                      <Text style={[styles.tableHeader, { width: COL_WIDTH }]}>Time</Text>
                      {fields.map((f: any) => (
                        <Text key={f.key} style={[styles.tableHeader, { width: COL_WIDTH }]} numberOfLines={1}>{f.label}</Text>
                      ))}
                    </View>
                    {sortedScoped.map((it: any) => {
                      const d = new Date(it.recorded_at);
                      return (
                        <View key={it.id} style={[styles.tableRow, styles.tableRowDivider]}>
                          <Text style={[styles.tableCell, { width: COL_WIDTH }]}>{d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</Text>
                          <Text style={[styles.tableCell, { width: COL_WIDTH }]}>{d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Text>
                          {fields.map((f: any) => {
                            const display = formatFieldValue(f, it.vals[f.key]);
                            const cls = f.dataType === 'numeric' && selectedTypeId ? fieldClassification(selectedTypeId, f.key, it.vals, ageInMonths) : null;
                            return (
                              <Text
                                key={f.key}
                                style={[styles.tableCell, { width: COL_WIDTH }, cls ? { color: colors[clinicalColorKey(cls)], fontWeight: '700' } : null]}
                                numberOfLines={1}
                              >
                                {display}
                              </Text>
                            );
                          })}
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </Card>
            </>
          )}
        </ScrollView>
        {showScrollUpHint && (
          <TouchableOpacity
            style={[styles.scrollHint, styles.scrollHintTop]}
            activeOpacity={0.7}
            onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
            accessibilityLabel="Scroll to top"
          >
            <Text style={styles.scrollHintArrow}>{'↑'}</Text>
          </TouchableOpacity>
        )}
        {showScrollDownHint && (
          <TouchableOpacity
            style={[styles.scrollHint, styles.scrollHintBottom]}
            activeOpacity={0.7}
            onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
            accessibilityLabel="Scroll to bottom"
          >
            <Text style={styles.scrollHintArrow}>{'↓'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  shareButton: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  shareButtonDisabled: { opacity: 0.5 },
  tableRow: { flexDirection: 'row', paddingVertical: spacing.sm },
  tableRowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  tableHeader: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' as any },
  tableCell: { fontSize: 13, color: colors.text },
  scrollHint: {
    position: 'absolute',
    alignSelf: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B1A2B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  scrollHintTop: { top: spacing.xs },
  scrollHintBottom: { bottom: spacing.xs },
  scrollHintArrow: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryDark,
  }
});
