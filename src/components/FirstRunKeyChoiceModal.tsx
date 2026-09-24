import React, { useState } from 'react';
import { Modal, Text, TextInput, Alert, StyleSheet } from 'react-native';
import { generateRecoveryKey, getStoredRecoveryKey, storeRecoveryKeyOnDevice, setRecoveryKeyConfirmed } from '../services/crypto';
import { restoreEncryptedBackupFromFile } from '../services/backup';
import { pickAndReadBackupFile } from '../services/pickAndReadBackupFile';
import { setOnboardingChoice } from '../services/onboarding';
import { useProfile } from '../services/profileContext';
import { Screen, Button } from '../theme/components';
import { colors, spacing, typography, radius } from '../theme/tokens';

// Shown once, the first time a device with zero profiles reaches Profiles —
// asks whether this is a brand-new user (no key yet, generated later from
// Backup & Restore) or a returning user who already has a Recovery Key from a
// previous device/install (entered here, since there's no local backup on
// this device yet for automatic restore to find).
export default function FirstRunKeyChoiceModal({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const { reloadProfiles } = useProfile();
  const [step, setStep] = useState<'choice' | 'enterKey'>('choice');
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setStep('choice'); setKeyInput(''); };

  const chooseNew = async () => {
    // "I'm new" usually means there's nothing on this device yet, but a
    // leftover key can still be here from before (e.g. Delete All Data
    // deliberately keeps the key so old external backups stay restorable).
    // Silently reusing it would skip the normal show-key/confirm flow for
    // someone who just said they're new — so ask instead of assuming.
    const existingKey = await getStoredRecoveryKey();
    if (!existingKey) {
      await setOnboardingChoice('new');
      reset();
      onDone();
      return;
    }

    Alert.alert(
      'Recovery Key already on this device',
      "This device already has a Recovery Key from before (e.g. data you deleted earlier). Keep it so any backup file made with it can still be restored, or generate a new one for a clean start — backups made with the old key won't be restorable with a new one.",
      [
        { text: 'Keep existing key', onPress: async () => { await setOnboardingChoice('new'); reset(); onDone(); } },
        {
          text: 'Generate new key',
          style: 'destructive',
          onPress: async () => {
            const key = await generateRecoveryKey();
            await storeRecoveryKeyOnDevice(key);
            await setRecoveryKeyConfirmed(false);
            await setOnboardingChoice('new');
            reset();
            onDone();
          }
        },
      ]
    );
  };

  const chooseExisting = () => setStep('enterKey');

  const storeKey = async () => {
    const key = keyInput.trim();
    if (!key) { Alert.alert('Recovery Key required', 'Enter the Recovery Key from your previous device to continue.'); return false; }
    await storeRecoveryKeyOnDevice(key);
    // An existing user already has their own saved copy by definition — no
    // need to make them re-confirm a key they didn't just generate here.
    await setRecoveryKeyConfirmed(true);
    await setOnboardingChoice('existing');
    return true;
  };

  const handleRestoreNow = async () => {
    setBusy(true);
    try {
      if (!(await storeKey())) return;
      const content = await pickAndReadBackupFile();
      if (!content) return; // picker cancelled — key is already stored, they can restore later
      // No profiles exist yet at this point (that's the precondition for this
      // modal), so there's no conflict to resolve — a direct restore is safe.
      await restoreEncryptedBackupFromFile(content, keyInput.trim());
      await reloadProfiles();
      Alert.alert('Restore complete', 'Your data has been restored.');
      reset();
      onDone();
    } catch (e: any) {
      Alert.alert('Restore failed', e?.message ?? 'The Recovery Key may be wrong, or the file may be corrupted. You can try again from Backup & Restore later.');
    } finally {
      setBusy(false);
    }
  };

  const handleSkipRestore = async () => {
    setBusy(true);
    try {
      if (!(await storeKey())) return;
      reset();
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <Screen scroll>
        {step === 'choice' ? (
          <>
            <Text style={typography.h1}>Welcome to Health Diary</Text>
            <Text style={[typography.body, { marginTop: spacing.md }]}>
              Have you used Health Diary before, or is this your first time setting it up?
            </Text>
            <Button label="I'm new to Health Diary" onPress={chooseNew} style={{ marginTop: spacing.xl }} />
            <Button label="I already have a Recovery Key" variant="secondary" onPress={chooseExisting} style={{ marginTop: spacing.md }} />
          </>
        ) : (
          <>
            <Text style={typography.h1}>Enter Your Recovery Key</Text>
            <Text style={[typography.body, { marginTop: spacing.md }]}>
              Enter the Recovery Key you saved when you last backed up. You can restore your data now if you have the backup file handy, or skip and do it later from Backup & Restore.
            </Text>
            <TextInput
              value={keyInput}
              onChangeText={setKeyInput}
              placeholder="Recovery Key"
              autoCapitalize="none"
              style={styles.input}
            />
            <Button label={busy ? 'Working…' : 'Restore Now (choose backup file)'} onPress={handleRestoreNow} disabled={busy} style={{ marginTop: spacing.lg }} />
            <Button label="Skip — I'll restore later" variant="secondary" onPress={handleSkipRestore} disabled={busy} style={{ marginTop: spacing.md }} />
            <Button label="Back" variant="ghost" onPress={() => setStep('choice')} disabled={busy} style={{ marginTop: spacing.md }} />
          </>
        )}
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg, backgroundColor: colors.surface },
});
