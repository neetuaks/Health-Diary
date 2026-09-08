import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useProfile } from '../services/profileContext';
import { exportAllAsJSON, exportAllAsCSV } from '../services/dataExport';
import { exportDiagnostics } from '../services/diagnosticsLog';
import { createEncryptedBackup } from '../services/backup';
import * as LocalAuthentication from 'expo-local-authentication';
import { getStoredRecoveryKey } from '../services/crypto';
import { deleteAllData } from '../services/dataManager';
import ConfirmDeleteAllModal from '../components/ConfirmDeleteAllModal';
import { connectToGoogleDrivePKCE, uploadBackupToDrive, getAccessToken, disconnectDrive } from '../services/googleDriveBackup';
import * as FileSystem from 'expo-file-system';
import { getBackupReminderDays, setBackupReminderDays } from '../services/appSettings';
import { useEffect } from 'react';
import { useState } from 'react';

export default function SettingsScreen({ navigation }: any) {
  const { profiles } = useProfile();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [reminderDays, setReminderDaysState] = useState<number>(30);

  useEffect(() => {
    getBackupReminderDays().then(d => setReminderDaysState(d));
  }, []);

  const handleDeleteAll = () => {
    Alert.alert('Delete all data', 'This will permanently delete all profiles and readings. Type DELETE to confirm.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteAllData(); Alert.alert('Done'); } }
    ]);
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>Settings</Text>

      <View style={{ marginTop: 20 }}>
        <TouchableOpacity onPress={() => exportAllAsJSON()} style={{ padding: 12 }}>
          <Text>Export all data (JSON)</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => exportAllAsCSV()} style={{ padding: 12 }}>
          <Text>Export all data (CSV)</Text>
        </TouchableOpacity>
        <View style={{ padding: 12 }}>
          <Text>Backup reminder frequency (days)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <TextInput value={String(reminderDays)} onChangeText={t => setReminderDaysState(Number(t))} style={{ borderWidth: 1, borderColor: '#ddd', padding: 8, width: 80, marginRight: 12 }} keyboardType="numeric" />
            <TouchableOpacity onPress={async () => { await setBackupReminderDays(reminderDays); Alert.alert('Saved'); }} style={{ padding: 8, backgroundColor: '#0077CC', borderRadius: 6 }}><Text style={{ color: '#fff' }}>Save</Text></TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity onPress={() => createEncryptedBackup(true)} style={{ padding: 12 }}>
          <Text>Back Up Data (Encrypted)</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={async () => {
          try {
            const token = await getAccessToken();
            if (!token) {
              await connectToGoogleDrivePKCE();
            }
            const tempPath = FileSystem.cacheDirectory + 'healthdiary_backup.hdb';
            await createEncryptedBackup(true);
            const info = await FileSystem.getInfoAsync(tempPath);
            if (info.exists) {
              const res = await uploadBackupToDrive(tempPath);
              Alert.alert('Uploaded to Google Drive', `File id: ${res.id}`);
            } else {
              Alert.alert('Upload failed', 'Backup file not found in cache');
            }
          } catch (e:any) {
            Alert.alert('Drive backup failed', e?.message ?? String(e));
          }
        }} style={{ padding: 12 }}>
          <Text>Back Up to Google Drive (Optional)</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={async () => { await disconnectDrive(); Alert.alert('Disconnected'); }} style={{ padding: 12 }}>
          <Text>Disconnect Google Drive</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('DriveBackups')} style={{ padding: 12 }}>
          <Text>Manage Backups</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={async () => {
          const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Authenticate to view Recovery Key' });
          if (res.success) {
            const key = await getStoredRecoveryKey();
            Alert.alert('Recovery Key', key ?? 'No key stored on this device');
          } else {
            Alert.alert('Authentication failed');
          }
        }} style={{ padding: 12 }}>
          <Text>View Recovery Key</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setDeleteModalOpen(true)} style={{ padding: 12 }}>
          <Text style={{ color: '#D9534F' }}>Delete My Data (All)</Text>
        </TouchableOpacity>
        <ConfirmDeleteAllModal visible={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} />
        <TouchableOpacity onPress={() => exportDiagnostics()} style={{ padding: 12 }}>
          <Text>Report a Problem (Export Diagnostics)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
