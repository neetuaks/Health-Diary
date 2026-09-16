import React, { useEffect, useState } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet } from 'react-native';
import PhotoEntryModal from '../components/PhotoEntryModal';
import { useProfile } from '../services/profileContext';
import { daysSince } from '../services/utils';
import { getBackupReminderDays } from '../services/appSettings';
import { useNavigation } from '@react-navigation/native';
import { fetchReadingsForProfile, deleteReading } from '../services/readingService';
import ReadingItem from '../components/ReadingItem';
import NewRecordModal from '../components/NewRecordModal';
import { ParameterType } from '../types';
import { fetchParameterTypes } from '../services/parameterRegistry';
import { Screen, Banner, ActionSheet, EmptyState } from '../theme/components';
import { colors, spacing, typography, radius } from '../theme/tokens';

function groupByDay(readings: any[]) {
  const groups: Record<string, any[]> = {};
  readings.forEach(r => {
    const day = new Date(r.recorded_at).toDateString();
    groups[day] = groups[day] || [];
    groups[day].push(r);
  });
  return Object.keys(groups).map(day => ({ title: day, data: groups[day] }));
}

export default function DiaryScreen() {
  const { activeProfile } = useProfile();
  const [readings, setReadings] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [paramTypes, setParamTypes] = useState<ParameterType[]>([]);
  const [editingReading, setEditingReading] = useState<any | null>(null);
  const [hideBackupBanner, setHideBackupBanner] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [reminderDays, setReminderDays] = useState<number>(30);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const navigation = useNavigation<any>();

  useEffect(() => {
    fetchParameterTypes().then(setParamTypes);
  }, []);

  useEffect(() => {
    if (!activeProfile) return;
    fetchReadingsForProfile(activeProfile.id).then(rs => setReadings(rs));
  }, [activeProfile]);

  useEffect(() => {
    setSections(groupByDay(readings));
  }, [readings]);

  useEffect(() => {
    getBackupReminderDays().then(d => setReminderDays(d));
  }, []);

  const handleDelete = async (id: string) => {
    await deleteReading(id);
    setReadings(prev => prev.filter(r => r.id !== id));
  };

  return (
    <Screen>
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
          <Text style={[typography.h2, { marginBottom: spacing.md }]}>Diary for {activeProfile.name}</Text>
          <SectionList
            sections={sections}
            keyExtractor={(item: any) => item.id}
            renderItem={({ item }) => {
              const pt = paramTypes.find(p => p.id === item.parameter_type_id);
              return <ReadingItem reading={item} parameterDisplayName={pt?.display_name} onDelete={handleDelete} onPress={() => { setEditingReading(item); setModalVisible(true); }} />;
            }}
            renderSectionHeader={({ section: { title } }) => (
              <View style={styles.header}><Text style={typography.bodyBold}>{title}</Text></View>
            )}
            ListEmptyComponent={() => (
              <EmptyState title="No readings yet" subtitle="Tap + to add a new reading." />
            )}
          />

          <TouchableOpacity style={styles.fab} onPress={() => setActionSheetVisible(true)}>
            <Text style={{ color: colors.textOnPrimary, fontSize: 28 }}>+</Text>
          </TouchableOpacity>

          <ActionSheet
            visible={actionSheetVisible}
            onClose={() => setActionSheetVisible(false)}
            title="New Record"
            actions={[
              { label: 'Manual Entry', onPress: () => setModalVisible(true) },
              { label: 'Photo (OCR)', onPress: () => setPhotoModalVisible(true) }
            ]}
          />

          <NewRecordModal visible={modalVisible} editingReading={editingReading} onClose={() => { setModalVisible(false); setEditingReading(null); }} onSaved={() => {
            if (!activeProfile) return;
            fetchReadingsForProfile(activeProfile.id).then(setReadings);
            setEditingReading(null);
          }} />

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
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.xl, backgroundColor: colors.primary, padding: spacing.lg, borderRadius: radius.pill, elevation: 2 },
  header: { backgroundColor: colors.primaryMuted, padding: spacing.sm, borderRadius: radius.sm }
});
