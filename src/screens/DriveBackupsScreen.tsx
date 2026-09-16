import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert } from 'react-native';
import { listBackupsFromDrive, deleteBackupFromDrive, getAccessToken, connectToGoogleDrivePKCE, uploadBackupToDrive, disconnectDrive } from '../services/googleDriveBackup';
import { createEncryptedBackup } from '../services/backup';
import * as FileSystem from 'expo-file-system';
import { Screen, Card, Button } from '../theme/components';
import { colors, spacing, typography, radius } from '../theme/tokens';

export default function DriveBackupsScreen() {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        await connectToGoogleDrivePKCE();
      }
      const files = await listBackupsFromDrive();
      setBackups(files);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const handleUpload = async () => {
    try {
      const token = await getAccessToken();
      if (!token) await connectToGoogleDrivePKCE();
      const tempPath = FileSystem.cacheDirectory + 'healthdiary_backup.hdb';
      await createEncryptedBackup(true);
      const info = await FileSystem.getInfoAsync(tempPath);
      if (info.exists) {
        await uploadBackupToDrive(tempPath);
        await load();
        Alert.alert('Uploaded to Google Drive');
      } else {
        Alert.alert('Upload failed', 'Backup file not found in cache');
      }
    } catch (e: any) {
      Alert.alert('Drive backup failed', e?.message ?? String(e));
    }
  };

  const handleDisconnect = async () => {
    await disconnectDrive();
    setBackups([]);
    Alert.alert('Disconnected');
  };

  const renderItem = ({ item }: any) => (
    <View style={{ padding: spacing.md, borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between' }}>
      <View>
        <Text style={typography.bodyBold}>{item.name}</Text>
        <Text style={typography.caption}>{item.createdTime}</Text>
      </View>
      <TouchableOpacity onPress={() => {
        Alert.alert('Delete backup', `Delete ${item.name}?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteBackupFromDrive(item.id); await load(); Alert.alert('Deleted'); } catch (e: any) { Alert.alert('Delete failed', e?.message ?? String(e)); } } }
        ]);
      }}>
        <Text style={{ color: colors.danger, fontWeight: '600' }}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Screen>
      <Text style={typography.h1}>Drive Backups</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        <Button label="Upload New Backup" onPress={handleUpload} />
        <Button label={loading ? 'Refreshing…' : 'Refresh'} variant="secondary" onPress={load} disabled={loading} />
      </View>
      <Card style={{ marginTop: spacing.lg, padding: 0 }}>
        <FlatList
          data={backups}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          ListEmptyComponent={() => <Text style={[typography.caption, { padding: spacing.lg }]}>No backups uploaded yet.</Text>}
        />
      </Card>
      <Button label="Disconnect Google Drive" variant="ghost" onPress={handleDisconnect} style={{ marginTop: spacing.lg }} />
    </Screen>
  );
}
