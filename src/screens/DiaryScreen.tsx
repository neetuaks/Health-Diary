import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import PhotoEntryModal from '../components/PhotoEntryModal';
import { useProfile } from '../services/profileContext';
import { daysSince, ageInMonthsFromDOB, diaryColumnFields } from '../services/utils';
import { getBackupReminderDays } from '../services/appSettings';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { fetchReadingsForProfile, deleteReading } from '../services/readingService';
import ReadingItem from '../components/ReadingItem';
import NewRecordModal from '../components/NewRecordModal';
import { ParameterType } from '../types';
import { fetchParameterTypes } from '../services/parameterRegistry';
import { Screen, Banner, EmptyState, SegmentedControl } from '../theme/components';
import { colors, spacing, radius } from '../theme/tokens';

const DATE_COL_WIDTH = 60;

export default function DiaryScreen() {
  const { activeProfile } = useProfile();
  const [readings, setReadings] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [paramTypes, setParamTypes] = useState<ParameterType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [editingReading, setEditingReading] = useState<any | null>(null);
  const [hideBackupBanner, setHideBackupBanner] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [reminderDays, setReminderDays] = useState<number>(30);
  // Drives the scroll-position arrows below — a moved/edited record (e.g. pushed
  // down the list by a date change) can scroll out of view with nothing on screen
  // hinting there's more above or below, which read as "did my edit even save" in
  // testing even though it had. They're real tap-to-scroll buttons (not just a
  // passive hint) — a non-interactive overlay sitting on top of a list row just
  // let taps fall through to that row's own onPress (opening it for edit), which
  // was worse than not having an indicator at all.
  const [listHeight, setListHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const listRef = useRef<FlatList>(null);
  const navigation = useNavigation<any>();

  useEffect(() => {
    fetchParameterTypes().then(setParamTypes);
  }, []);

  // BP is the default tab when present, otherwise whichever type loads first.
  useEffect(() => {
    if (paramTypes.length > 0 && !selectedTypeId) {
      const bp = paramTypes.find(t => t.id === 'bp');
      setSelectedTypeId(bp ? bp.id : paramTypes[0].id);
    }
  }, [paramTypes, selectedTypeId]);

  // Refetches on every focus, not just once on mount/profile-switch — this screen
  // stays mounted in the background on a bottom-tab navigator, so without this,
  // data changed elsewhere while Diary wasn't the active tab (e.g. a backup restore
  // run from Settings) wouldn't show up here until something else forced a refetch.
  useFocusEffect(
    useCallback(() => {
      if (!activeProfile) return;
      fetchReadingsForProfile(activeProfile.id).then(rs => setReadings(rs));
    }, [activeProfile])
  );

  useEffect(() => {
    getBackupReminderDays().then(d => setReminderDays(d));
  }, []);

  const handleDelete = async (id: string) => {
    await deleteReading(id);
    setReadings(prev => prev.filter(r => r.id !== id));
  };

  const selectedType = paramTypes.find(t => t.id === selectedTypeId) ?? null;
  const columnFields = diaryColumnFields(selectedType);
  const filteredReadings = selectedTypeId
    ? readings
        .filter(r => r.parameter_type_id === selectedTypeId)
        .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
    : [];

  // Stable reference (memoized on the id, not recreated every render) so opening the
  // modal for a new entry doesn't retrigger its reset effect while it's already open —
  // see NewRecordModal's own reset-on-open effect for why that matters.
  const newEntryInitialValues = useMemo(
    () => (selectedTypeId ? { parameter_type_id: selectedTypeId } : null),
    [selectedTypeId]
  );

  const canScroll = contentHeight > listHeight + 1;
  const showScrollUpHint = canScroll && scrollY > 2;
  const showScrollDownHint = canScroll && scrollY < contentHeight - listHeight - 2;

  return (
    <Screen topInset={false}>
      {!activeProfile ? (
        <EmptyState title="No profile yet" subtitle="Add a profile to get started." />
      ) : (
        <View style={{ flex: 1 }}>
          {!hideBackupBanner && readings.length > 0 && (daysSince(activeProfile.last_backup_at) > reminderDays) && (
            <Banner
              variant="warning"
              message={`You haven't backed up your data in ${daysSince(activeProfile.last_backup_at)} days. Your data lives only on this phone and won't survive an app reinstall or a new device unless you back it up. Tap to back up now.`}
              onPress={() => navigation.navigate('Backup')}
              onDismiss={() => setHideBackupBanner(true)}
            />
          )}

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <SegmentedControl
                options={paramTypes.map(t => ({ key: t.id, label: t.display_name }))}
                value={selectedTypeId ?? ''}
                onChange={setSelectedTypeId}
              />
            </View>
            <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)} accessibilityLabel="Add record">
              <Text style={styles.addButtonGlyph}>+</Text>
            </TouchableOpacity>
          </View>

          {selectedType && (
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderLabel, { width: DATE_COL_WIDTH }]}>Date</Text>
              <View style={styles.tableHeaderValues}>
                {columnFields.map(f => (
                  <Text key={f.key} style={[styles.tableHeaderLabel, styles.tableHeaderValueCell]} numberOfLines={1}>
                    {f.label}
                  </Text>
                ))}
              </View>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <FlatList
              ref={listRef}
              data={filteredReadings}
              keyExtractor={(item: any) => item.id}
              renderItem={({ item }) => (
                <ReadingItem
                  reading={item}
                  parameterType={selectedType ?? undefined}
                  onDelete={handleDelete}
                  onPress={() => { setEditingReading(item); setModalVisible(true); }}
                  ageInMonths={ageInMonthsFromDOB(activeProfile.date_of_birth)}
                />
              )}
              ListEmptyComponent={() => (
                <EmptyState title="No readings yet" subtitle={`Tap + to add a new ${selectedType?.display_name ?? ''} reading.`} />
              )}
              onLayout={e => setListHeight(e.nativeEvent.layout.height)}
              onContentSizeChange={(_, h) => setContentHeight(h)}
              onScroll={e => setScrollY(e.nativeEvent.contentOffset.y)}
              scrollEventThrottle={32}
            />
            {showScrollUpHint && (
              <TouchableOpacity
                style={[styles.scrollHint, styles.scrollHintTop]}
                activeOpacity={0.7}
                onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
                accessibilityLabel="Scroll to top"
              >
                <Text style={styles.scrollHintArrow}>{'↑'}</Text>
              </TouchableOpacity>
            )}
            {showScrollDownHint && (
              <TouchableOpacity
                style={[styles.scrollHint, styles.scrollHintBottom]}
                activeOpacity={0.7}
                onPress={() => listRef.current?.scrollToEnd({ animated: true })}
                accessibilityLabel="Scroll to bottom"
              >
                <Text style={styles.scrollHintArrow}>{'↓'}</Text>
              </TouchableOpacity>
            )}
          </View>

          <NewRecordModal
            visible={modalVisible}
            editingReading={editingReading}
            initialValues={editingReading ? null : newEntryInitialValues}
            onClose={() => { setModalVisible(false); setEditingReading(null); }}
            onSaved={() => {
              if (!activeProfile) return;
              fetchReadingsForProfile(activeProfile.id).then(setReadings);
              setEditingReading(null);
            }}
            // Camera/OCR entry is paused: NewRecordModal only shows its camera icon when
            // onScanPhoto is passed. Re-add it to re-enable:
            // onScanPhoto={() => { setModalVisible(false); setPhotoModalVisible(true); }}
          />

          <PhotoEntryModal visible={photoModalVisible} onClose={() => setPhotoModalVisible(false)} onSaved={() => {
            if (!activeProfile) return;
            fetchReadingsForProfile(activeProfile.id).then(setReadings);
          }} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  addButton: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  addButtonGlyph: { color: colors.primaryDark, fontSize: 22, fontWeight: '700', lineHeight: 24 },
  tableHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  tableHeaderLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' as any },
  tableHeaderValues: { flex: 1, flexDirection: 'row', marginLeft: spacing.md },
  tableHeaderValueCell: { flex: 1, textAlign: 'center' },
  // Positioned as its own small tappable circle rather than a full-width strip, so
  // it reads as a floating button (and only intercepts taps in that small area) —
  // not a transparent band across the whole list width.
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
