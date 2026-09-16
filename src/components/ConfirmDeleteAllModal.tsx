import React, { useState } from 'react';
import { Modal, View, Text, TextInput, Alert, StyleSheet } from 'react-native';
import { deleteAllData } from '../services/dataManager';
import { Screen, Button } from '../theme/components';
import { colors, spacing, typography, radius } from '../theme/tokens';

export default function ConfirmDeleteAllModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [text, setText] = useState('');

  const confirm = async () => {
    if (text !== 'DELETE') return Alert.alert('Type DELETE to confirm');
    await deleteAllData();
    setText('');
    Alert.alert('All data deleted');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide">
      <Screen>
        <Text style={typography.h1}>Delete All Data</Text>
        <Text style={[typography.body, { marginTop: spacing.md }]}>This will permanently delete ALL profiles and readings. This cannot be undone. Type DELETE to confirm.</Text>
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
