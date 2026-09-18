import React, { useState } from 'react';
import { Modal, View, Text, TextInput, Alert, StyleSheet } from 'react-native';
import { deleteAllData } from '../services/dataManager';
import { localBackupCopyExists } from '../services/backup';
import { useProfile } from '../services/profileContext';
import { Screen, Button } from '../theme/components';
import { colors, spacing, typography, radius } from '../theme/tokens';

export default function ConfirmDeleteAllModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { reloadProfiles } = useProfile();
  const [text, setText] = useState('');

  const runDelete = async (deleteLocalBackup: boolean) => {
    await deleteAllData(deleteLocalBackup);
    await reloadProfiles();
    setText('');
    Alert.alert('All data deleted');
    onClose();
  };

  const confirm = async () => {
    if (text !== 'DELETE') return Alert.alert('Type DELETE to confirm');

    // Only worth asking if there's actually a local backup copy to make a
    // choice about — otherwise there's nothing for the question to mean.
    if (!(await localBackupCopyExists())) {
      await runDelete(false);
      return;
    }

    Alert.alert(
      'Also delete your backup copy?',
      "This device has an automatic backup copy of your data. Keep it and you can restore this data later from Backup & Restore. Delete it and it's gone for good, along with everything else.",
      [
        { text: 'Keep backup', onPress: () => runDelete(false) },
        { text: 'Delete backup too', style: 'destructive', onPress: () => runDelete(true) },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide">
      <Screen>
        <Text style={typography.h1}>Delete All Data</Text>
        <Text style={[typography.body, { marginTop: spacing.md }]}>This will permanently delete ALL profiles and readings stored on this device. If you have an automatic backup copy on this device, you'll be asked separately whether to delete that too. It won't affect any backup files you've already shared or saved elsewhere (e.g. Drive, email, Files) — those aren't something this app can reach. Your Recovery Key is kept. This cannot be undone. Type DELETE to confirm.</Text>
        <TextInput value={text} onChangeText={setText} autoCapitalize="characters" style={styles.input} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg }}>
          <Button label="Cancel" variant="secondary" onPress={() => { setText(''); onClose(); }} />
          <Button label="Delete" variant="destructive" onPress={confirm} disabled={text !== 'DELETE'} />
        </View>
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, backgroundColor: colors.surface }
});
