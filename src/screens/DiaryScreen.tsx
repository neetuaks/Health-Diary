import React, { useEffect, useState } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
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
    <View style={{ flex: 1 }}>
      {!activeProfile ? (
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <Text style={{ fontSize: 18 }}>No profile yet</Text>
          <Text style={{ color: '#666', marginTop: 8 }}>Add a profile to get started.</Text>
        </View>
      ) : (
        <View style={{ flex: 1, padding: 16 }}>
          {!hideBackupBanner && activeProfile && readings.length > 0 && (daysSince(activeProfile.last_backup_at) > reminderDays) && (
            <TouchableOpacity onPress={() => navigation.navigate('Backup')} style={{ backgroundColor: '#FFF4E5', padding: 12, borderRadius: 8, marginBottom: 12 }}>
              <Text style={{ color: '#7A4A00' }}>You haven't backed up your data in {daysSince(activeProfile.last_backup_at)} days. Your data lives only on this phone and won't survive an app reinstall or a new device unless you back it up. Tap to back up now. Dismiss</Text>
              <TouchableOpacity onPress={() => setHideBackupBanner(true)}><Text style={{ color: '#0077CC', marginTop: 6 }}>Dismiss</Text></TouchableOpacity>
            </TouchableOpacity>
          )}
          <Text style={{ fontSize: 16, marginBottom: 12 }}>Diary for {activeProfile.name}</Text>
          <SectionList
            sections={sections}
            keyExtractor={(item: any) => item.id}
            renderItem={({ item }) => {
              const pt = paramTypes.find(p => p.id === item.parameter_type_id);
              return <ReadingItem reading={item} parameterDisplayName={pt?.display_name} onDelete={handleDelete} onPress={() => { setEditingReading(item); setModalVisible(true); }} />;
            }}
            renderSectionHeader={({ section: { title } }) => (
              <View style={styles.header}><Text style={{ fontWeight: '700' }}>{title}</Text></View>
            )}
            ListEmptyComponent={() => (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={{ fontSize: 16 }}>No readings yet</Text>
                <Text style={{ color: '#666', marginTop: 8 }}>Tap + to add a new reading.</Text>
              </View>
            )}
          />

          <TouchableOpacity style={styles.fab} onPress={() => {
            // offer Manual vs Photo entry
            Alert.alert('New Record', 'Choose entry method', [
              { text: 'Manual', onPress: () => setModalVisible(true) },
              { text: 'Photo (OCR)', onPress: () => setPhotoModalVisible(true) },
              { text: 'Cancel', style: 'cancel' }
            ]);
          }}>
            <Text style={{ color: '#fff', fontSize: 28 }}>+</Text>
          </TouchableOpacity>

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
    </View>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 16, bottom: 24, backgroundColor: '#0077CC', padding: 16, borderRadius: 32, elevation: 2 },
  header: { backgroundColor: '#F3F9FF', padding: 8 }
});

