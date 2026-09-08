import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { generateRecoveryKey, storeRecoveryKeyOnDevice, getStoredRecoveryKey } from '../services/crypto';
import { createEncryptedBackup, peekEncryptedBackup, restoreEncryptedBackupFromFile } from '../services/backup';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function BackupScreen() {
  const [recovery, setRecovery] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleGenerate = async () => {
    const key = await generateRecoveryKey();
    await storeRecoveryKeyOnDevice(key);
    setRecovery(key);
    Alert.alert('Recovery Key generated', 'Save this key now. You can share it using the Share button.');
  };

  const handleShareKey = async () => {
    if (!recovery) return Alert.alert('No key', 'Generate a Recovery Key first');
    const path = FileSystem.cacheDirectory + 'recovery_key.txt';
    await FileSystem.writeAsStringAsync(path, recovery, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(path);
  };

  const handleBackup = async () => {
    if (!confirmed) return Alert.alert('Confirm', 'Please confirm you have saved the Recovery Key.');
    await createEncryptedBackup(true);
    Alert.alert('Backup created and shared via OS share sheet');
  };

  const handleRestore = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.type !== 'success') return;
    const content = await FileSystem.readAsStringAsync(res.uri, { encoding: FileSystem.EncodingType.UTF8 });
    try {
      // preview decrypted payload to detect conflicts
      const obj = await peekEncryptedBackup(content);
      const existingIds: string[] = [];
      const db = require('../db/init').getDB();
      db.transaction(tx => {
        tx.executeSql('SELECT id FROM profiles;', [], (_, r) => {
          for (let i = 0; i < r.rows.length; i++) existingIds.push(r.rows.item(i).id);
        });
      }, () => {
        // failed to read db, fallback to direct restore
        restoreEncryptedBackupFromFile(content).then(() => Alert.alert('Restore complete')).catch((e:any) => Alert.alert('Restore failed', e?.message ?? String(e)));
      }, () => {
        // check for conflicts
        const conflict = (obj.profiles || []).some((p:any) => existingIds.includes(p.id));
        if (!conflict) {
          restoreEncryptedBackupFromFile(content).then(() => Alert.alert('Restore complete')).catch((e:any) => Alert.alert('Restore failed', e?.message ?? String(e)));
        } else {
          // ask user merge vs replace
          setRestoreModalOpen(true);
          setPendingRestoreContent(content);
        }
      });
    } catch (e: any) {
      Alert.alert('Restore failed', e?.message ?? String(e));
    }
  };

  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [pendingRestoreContent, setPendingRestoreContent] = useState<string | null>(null);

  const handleRestoreChoice = async (choice: 'merge' | 'replace') => {
    if (!pendingRestoreContent) { setRestoreModalOpen(false); return; }
    try {
      await restoreEncryptedBackupFromFile(pendingRestoreContent, undefined, { replace: choice === 'replace' });
      Alert.alert('Restore complete');
    } catch (e:any) {
      Alert.alert('Restore failed', e?.message ?? String(e));
    } finally {
      setRestoreModalOpen(false);
      setPendingRestoreContent(null);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>Backup & Restore</Text>

      <View style={{ marginTop: 12 }}>
        <TouchableOpacity onPress={handleGenerate} style={{ padding: 12 }}>
          <Text>Generate Recovery Key</Text>
        </TouchableOpacity>
        {recovery && (
          <View style={{ marginTop: 8 }}>
            <Text selectable>{recovery}</Text>
            <TouchableOpacity onPress={handleShareKey} style={{ padding: 8 }}><Text>Share Recovery Key</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { setConfirmed(true); Alert.alert('Confirmed', 'Recovery Key confirmed saved'); }} style={{ padding: 8 }}><Text>I've saved my Recovery Key</Text></TouchableOpacity>
          </View>
        )}

        <TouchableOpacity onPress={handleBackup} style={{ marginTop: 12, backgroundColor: '#0077CC', padding: 12, borderRadius: 8 }}>
          <Text style={{ color: '#fff' }}>Back Up Data (Encrypted)</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleRestore} style={{ marginTop: 12, padding: 12 }}>
          <Text>Restore from Backup</Text>
        </TouchableOpacity>
        <RestoreOptionsModal visible={restoreModalOpen} onClose={() => setRestoreModalOpen(false)} onChoose={choice => handleRestoreChoice(choice)} />
      </View>
    </View>
  );
}
