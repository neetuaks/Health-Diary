import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert } from 'react-native';
import { listBackupsFromDrive, deleteBackupFromDrive, getAccessToken, connectToGoogleDrivePKCE } from '../services/googleDriveBackup';

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
    } catch (e:any) {
      Alert.alert('Error', e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const renderItem = ({ item }: any) => (
    <View style={{ padding: 12, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', justifyContent: 'space-between' }}>
      <View>
        <Text style={{ fontWeight: '600' }}>{item.name}</Text>
        <Text style={{ color: '#666' }}>{item.createdTime}</Text>
      </View>
      <View style={{ flexDirection: 'row' }}>
        <TouchableOpacity onPress={() => {
          Alert.alert('Delete backup', `Delete ${item.name}?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteBackupFromDrive(item.id); await load(); Alert.alert('Deleted'); } catch (e:any) { Alert.alert('Delete failed', e?.message ?? String(e)); } } }
          ]);
        }} style={{ padding: 8 }}>
          <Text style={{ color: '#D9534F' }}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>Drive Backups</Text>
      <TouchableOpacity onPress={load} style={{ padding: 12 }}>
        <Text>{loading ? 'Refreshing...' : 'Refresh'}</Text>
      </TouchableOpacity>
      <FlatList data={backups} keyExtractor={i => i.id} renderItem={renderItem} />
    </View>
  );
}
