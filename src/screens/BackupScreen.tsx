import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Alert, StyleSheet } from 'react-native';
import { generateRecoveryKey, storeRecoveryKeyOnDevice, getStoredRecoveryKey, getRecoveryKeyConfirmed, setRecoveryKeyConfirmed } from '../services/crypto';
import { createEncryptedBackup, peekEncryptedBackup, restoreEncryptedBackupFromFile, readLocalBackupCopy } from '../services/backup';
import { generateRecoveryKeyPDF } from '../services/pdf';
import { pickAndReadBackupFile } from '../services/pickAndReadBackupFile';
import { tryAuthenticate } from '../services/deviceAuth';
import { shareFile } from '../services/share';
import RestoreOptionsModal from '../components/RestoreOptionsModal';
import { getDB } from '../db/init';
import { useProfile } from '../services/profileContext';
import { Screen, Button, Card, Banner } from '../theme/components';
import { colors, spacing, typography, radius } from '../theme/tokens';

export default function BackupScreen() {
  const { reloadProfiles } = useProfile();
  const [recovery, setRecovery] = useState<string | null>(null);
  // Whether the user has confirmed they saved a copy of the key elsewhere.
  // Persisted (not just local state) so a confirmed key stays hidden across
  // app restarts, not just for the rest of this session.
  const [confirmed, setConfirmed] = useState(false);
  const [restoreKeyInput, setRestoreKeyInput] = useState('');
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [pendingRestoreContent, setPendingRestoreContent] = useState<string | null>(null);
  const [pendingRestoreKey, setPendingRestoreKey] = useState<string | undefined>(undefined);
  // Set once a backup file has actually been written to disk; Share/Save stays
  // disabled until then, and a fresh "Back Up Data" tap clears it so a stale file
  // from an earlier tap can't be shared as if it were current.
  const [backupUri, setBackupUri] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [sharingBackup, setSharingBackup] = useState(false);
  // Whether this device already has its own local backup copy — when true,
  // restore can happen automatically without the user hunting for a file.
  const [hasLocalBackup, setHasLocalBackup] = useState(false);
  const [showManualRestore, setShowManualRestore] = useState(false);

  useEffect(() => {
    getStoredRecoveryKey().then(key => { if (key) setRecovery(key); });
    getRecoveryKeyConfirmed().then(setConfirmed);
    readLocalBackupCopy().then(content => setHasLocalBackup(!!content));
  }, []);

  const handleGenerate = async () => {
    const key = await generateRecoveryKey();
    await storeRecoveryKeyOnDevice(key);
    await setRecoveryKeyConfirmed(false);
    setRecovery(key);
    setConfirmed(false);
  };

  const handleConfirmSaved = async () => {
    await setRecoveryKeyConfirmed(true);
    setConfirmed(true);
  };

  // The key is only ever shown right after it's generated, until confirmed —
  // after that it stays hidden on every future visit to this screen. This is
  // the one deliberate way back in for someone who confirmed too hastily, or
  // whose saved copy was lost.
  const handleShowKeyAgain = () => {
    Alert.alert(
      "Haven't saved your key?",
      'This will show your Recovery Key again so you can save it somewhere safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Show it', onPress: async () => { await setRecoveryKeyConfirmed(false); setConfirmed(false); } }
      ]
    );
  };

  const handleShareKey = async () => {
    if (!recovery) return Alert.alert('No key', 'Generate a Recovery Key first');
    try {
      const path = await generateRecoveryKeyPDF(recovery);
      await shareFile(path, 'Health Diary Recovery Key', 'application/pdf');
    } catch (e: any) {
      Alert.alert('Could not share key', e?.message ?? 'Please try again.');
    }
  };

  const handleBackup = async () => {
    if (!recovery) {
      Alert.alert('Generate a Recovery Key first', 'You need a Recovery Key before your first backup — tap "Generate Recovery Key" above.');
      return;
    }
    if (!confirmed) return Alert.alert('Confirm', 'Please confirm you have saved the Recovery Key.');
    if (!(await tryAuthenticate('Authenticate to back up your data'))) return;
    setBackingUp(true);
    setBackupUri(null);
    try {
      const { uri } = await createEncryptedBackup();
      setBackupUri(uri);
      setHasLocalBackup(true);
      // The local safety copy is intentionally never mentioned here — it's an
      // invisible, unconfigurable background detail on both platforms, not
      // something the user manages.
      Alert.alert('Backup created', 'Your encrypted backup file is ready on this device. Tap "Share / Save Backup" below to send it or save it elsewhere.');
    } catch (e: any) {
      Alert.alert('Backup failed', e?.message ?? 'Please try again.');
    } finally {
      setBackingUp(false);
    }
  };

  const handleShareBackup = async () => {
    if (!backupUri) return;
    setSharingBackup(true);
    try {
      await shareFile(backupUri, 'Health Diary Backup', 'application/json');
    } finally {
      setSharingBackup(false);
    }
  };

  // Shared by both restore paths (automatic local + manual file pick) once the
  // raw file content is in hand: decrypt, check for a profile-id conflict with
  // what's already on this device, and either restore directly or hand off to
  // the merge/replace modal.
  const restoreFromContent = async (content: string, keyToUse: string | undefined) => {
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
        await reloadProfiles();
        Alert.alert('Restore complete');
      } else {
        setPendingRestoreContent(content);
        setPendingRestoreKey(keyToUse);
        setRestoreModalOpen(true);
      }
    } catch (e: any) {
      // Surface the actual error rather than always showing the same generic
      // "key may be wrong" message — that made every restore failure look
      // identical (wrong key, corrupt file, unreadable URI, etc.) with no way to
      // tell which one actually happened.
      Alert.alert('Restore failed', e?.message ?? 'The Recovery Key may be wrong, or the file may be corrupted. Please check the key and try again.');
    }
  };

  // Restores from this device's own automatic local backup copy — no file
  // picker, no key entry. The user doesn't know (and shouldn't need to know)
  // where that file lives; its presence is exactly what makes this "not a new
  // device" in the first place.
  const handleRestoreFromLocal = async () => {
    if (!(await tryAuthenticate('Authenticate to restore your data'))) return;
    const content = await readLocalBackupCopy();
    if (!content) {
      Alert.alert('No backup found', 'No automatic backup was found on this device.');
      setHasLocalBackup(false);
      return;
    }
    await restoreFromContent(content, undefined);
  };

  const handleRestore = async () => {
    if (!(await tryAuthenticate('Authenticate to restore your data'))) return;
    const keyToUse = restoreKeyInput.trim() || undefined;
    let content: string | null;
    try {
      content = await pickAndReadBackupFile();
      if (content === null) return; // cancelled
    } catch (e: any) {
      Alert.alert('Could not read the backup file', e?.message ?? 'Please try again.');
      return;
    }
    await restoreFromContent(content, keyToUse);
  };

  const handleRestoreChoice = async (choice: 'merge' | 'replace') => {
    if (!pendingRestoreContent) { setRestoreModalOpen(false); return; }
    try {
      await restoreEncryptedBackupFromFile(pendingRestoreContent, pendingRestoreKey, { replace: choice === 'replace' });
      await reloadProfiles();
      Alert.alert('Restore complete');
    } catch (e: any) {
      Alert.alert('Restore failed', e?.message ?? 'The Recovery Key may be wrong, or the file may be corrupted. Please check the key and try again.');
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
        {recovery && confirmed ? (
          <>
            <Text style={[typography.body, { marginTop: spacing.xs }]}>Recovery Key saved and confirmed.</Text>
            <Button label="Haven't saved it? Show key again" size="sm" variant="ghost" onPress={handleShowKeyAgain} style={{ marginTop: spacing.sm }} />
          </>
        ) : recovery ? (
          <>
            <Text style={[typography.body, styles.keyText]} selectable>{recovery}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <Button label="Share Key" variant="secondary" onPress={handleShareKey} />
              <Button label="I've saved my key" onPress={handleConfirmSaved} />
            </View>
            <Banner variant="warning" message="Save this key now — it can't be recovered later. You need it to restore your data on another device." />
          </>
        ) : (
          <>
            <Text style={typography.caption}>You need a Recovery Key before your first backup.</Text>
            <Button label="Generate Recovery Key" onPress={handleGenerate} style={{ marginTop: spacing.md }} />
          </>
        )}
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={typography.h2}>Back Up Data</Text>
        <Button
          label={backingUp ? 'Creating backup…' : 'Back Up Data (Encrypted)'}
          onPress={handleBackup}
          disabled={backingUp}
          style={{ marginTop: spacing.md }}
        />
        {backupUri && (
          <>
            <Banner variant="info" message="Backup file ready on this device. Share or save it somewhere safe — it won't be sent anywhere until you do." />
            <Button
              label={sharingBackup ? 'Opening…' : 'Share / Save Backup'}
              variant="secondary"
              onPress={handleShareBackup}
              disabled={sharingBackup}
              style={{ marginTop: spacing.md }}
            />
          </>
        )}
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={typography.h2}>Restore from Backup</Text>
        {hasLocalBackup && !showManualRestore ? (
          <>
            <Text style={[typography.caption, { marginTop: spacing.xs }]}>
              This device already has a backup — restore it automatically, no file or key needed.
            </Text>
            <Button label="Restore from Device Backup" variant="secondary" onPress={handleRestoreFromLocal} style={{ marginTop: spacing.md }} />
            <Button
              label="Restore from a different backup file…"
              size="sm"
              variant="ghost"
              onPress={() => setShowManualRestore(true)}
              style={{ marginTop: spacing.sm }}
            />
          </>
        ) : (
          <>
            <Text style={[typography.caption, { marginTop: spacing.xs }]}>
              {recovery
                ? 'Leave the field below blank to use the Recovery Key already saved on this device.'
                : 'New device? Enter the Recovery Key you saved when you backed up, then choose the backup file.'}
            </Text>
            <TextInput
              value={restoreKeyInput}
              onChangeText={setRestoreKeyInput}
              placeholder={recovery ? 'Recovery Key (optional on this device)' : 'Recovery Key'}
              autoCapitalize="none"
              style={styles.input}
            />
            <Button label="Choose Backup File & Restore" variant="secondary" onPress={handleRestore} style={{ marginTop: spacing.md }} />
            {hasLocalBackup && (
              <Button
                label="Back to automatic restore"
                size="sm"
                variant="ghost"
                onPress={() => setShowManualRestore(false)}
                style={{ marginTop: spacing.sm }}
              />
            )}
          </>
        )}
      </Card>

      <RestoreOptionsModal visible={restoreModalOpen} onClose={() => setRestoreModalOpen(false)} onChoose={choice => handleRestoreChoice(choice)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyText: { marginTop: spacing.sm, fontFamily: 'monospace' as any, backgroundColor: colors.background, padding: spacing.md, borderRadius: radius.md },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, backgroundColor: colors.surface },
});
