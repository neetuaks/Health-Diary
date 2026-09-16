import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Alert, StyleSheet } from 'react-native';
import { generateRecoveryKey, storeRecoveryKeyOnDevice, getStoredRecoveryKey } from '../services/crypto';
import { createEncryptedBackup, peekEncryptedBackup, restoreEncryptedBackupFromFile } from '../services/backup';
import { tryAuthenticate } from '../services/deviceAuth';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import RestoreOptionsModal from '../components/RestoreOptionsModal';
import { getDB } from '../db/init';
import { Screen, Button, Card, Banner } from '../theme/components';
import { colors, spacing, typography, radius } from '../theme/tokens';

export default function BackupScreen() {
  const [recovery, setRecovery] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [restoreKeyInput, setRestoreKeyInput] = useState('');
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [pendingRestoreContent, setPendingRestoreContent] = useState<string | null>(null);
  const [pendingRestoreKey, setPendingRestoreKey] = useState<string | undefined>(undefined);

  useEffect(() => {
    getStoredRecoveryKey().then(key => {
      if (key) { setRecovery(key); setConfirmed(true); }
    });
  }, []);

  const handleGenerate = async () => {
    const key = await generateRecoveryKey();
    await storeRecoveryKeyOnDevice(key);
    setRecovery(key);
    setConfirmed(false);
  };

  const handleShareKey = async () => {
    if (!recovery) return Alert.alert('No key', 'Generate a Recovery Key first');
    const path = FileSystem.cacheDirectory + 'recovery_key.txt';
    await FileSystem.writeAsStringAsync(path, recovery, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(path);
  };

  const handleBackup = async () => {
    if (!recovery) {
      Alert.alert('Generate a Recovery Key first', 'You need a Recovery Key before your first backup — tap "Generate Recovery Key" above.');
      return;
    }
    if (!confirmed) return Alert.alert('Confirm', 'Please confirm you have saved the Recovery Key.');
    if (!(await tryAuthenticate('Authenticate to back up your data'))) return;
    await createEncryptedBackup(true);
    Alert.alert('Backup created', 'Your encrypted backup was created and shared via the OS share sheet.');
  };

  const handleRestore = async () => {
    if (!(await tryAuthenticate('Authenticate to restore your data'))) return;
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled || !res.assets || res.assets.length === 0) return;
    const content = await FileSystem.readAsStringAsync(res.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
    const keyToUse = restoreKeyInput.trim() || undefined;
    try {
      const obj = await peekEncryptedBackup(content, keyToUse);
      let existingIds: string[] = [];
      try {
        const db = getDB();
        const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM profiles;');
        existingIds = rows.map(r => r.id);
      } catch (e) {
        // failed to read db, fallback to direct restore
      }

      const conflict = (obj.profiles || []).some((p: any) => existingIds.includes(p.id));
      if (!conflict) {
        await restoreEncryptedBackupFromFile(content, keyToUse);
        Alert.alert('Restore complete');
      } else {
        setPendingRestoreContent(content);
        setPendingRestoreKey(keyToUse);
        setRestoreModalOpen(true);
      }
    } catch (e: any) {
      Alert.alert('Restore failed', 'The Recovery Key may be wrong, or the file may be corrupted. Please check the key and try again.');
    }
  };

  const handleRestoreChoice = async (choice: 'merge' | 'replace') => {
    if (!pendingRestoreContent) { setRestoreModalOpen(false); return; }
    try {
      await restoreEncryptedBackupFromFile(pendingRestoreContent, pendingRestoreKey, { replace: choice === 'replace' });
      Alert.alert('Restore complete');
    } catch (e: any) {
      Alert.alert('Restore failed', 'The Recovery Key may be wrong, or the file may be corrupted. Please check the key and try again.');
    } finally {
      setRestoreModalOpen(false);
      setPendingRestoreContent(null);
      setPendingRestoreKey(undefined);
    }
  };

  return (
    <Screen scroll>
      <Text style={typography.h1}>Backup & Restore</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={typography.h2}>Recovery Key</Text>
        {recovery ? (
          <>
            <Text style={[typography.body, styles.keyText]} selectable>{recovery}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <Button label="Share Key" variant="secondary" onPress={handleShareKey} />
              {!confirmed && <Button label="I've saved my key" onPress={() => setConfirmed(true)} />}
            </View>
            {!confirmed && (
              <Banner variant="warning" message="Save this key now — it can't be recovered later. You need it to restore your data on another device." />
            )}
          </>
        ) : (
          <>
            <Text style={typography.caption}>You need a Recovery Key before your first backup.</Text>
            <Button label="Generate Recovery Key" onPress={handleGenerate} style={{ marginTop: spacing.md }} />
          </>
        )}
      </Card>

      <Button label="Back Up Data (Encrypted)" onPress={handleBackup} style={{ marginTop: spacing.lg }} />

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={typography.h2}>Restore from Backup</Text>
        <Text style={[typography.caption, { marginTop: spacing.xs }]}>
          Restoring on this device? Leave the field below blank to use the key already saved here. Restoring on a new device? Enter your Recovery Key.
        </Text>
        <TextInput
          value={restoreKeyInput}
          onChangeText={setRestoreKeyInput}
          placeholder="Recovery Key (optional on this device)"
          autoCapitalize="none"
          style={styles.input}
        />
        <Button label="Choose Backup File & Restore" variant="secondary" onPress={handleRestore} style={{ marginTop: spacing.md }} />
      </Card>

      <RestoreOptionsModal visible={restoreModalOpen} onClose={() => setRestoreModalOpen(false)} onChoose={choice => handleRestoreChoice(choice)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyText: { marginTop: spacing.sm, fontFamily: 'monospace' as any, backgroundColor: colors.background, padding: spacing.md, borderRadius: radius.md },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, backgroundColor: colors.surface }
});
