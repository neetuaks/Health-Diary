import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { Button, Card } from '../theme/components';
import { spacing, typography } from '../theme/tokens';

export default function RestoreOptionsModal({ visible, onClose, onChoose, busy }: { visible: boolean; onClose: () => void; onChoose: (choice: 'merge' | 'replace') => void; busy?: boolean }) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <Card style={styles.dialog}>
          <Text style={typography.h2}>Restore Options</Text>
          <Text style={[typography.body, { marginTop: spacing.sm }]}>Conflicts detected with existing data. Choose how to restore:</Text>
          <Button
            label={busy ? 'Restoring…' : 'Merge (keep existing, add/replace by id)'}
            onPress={() => onChoose('merge')}
            disabled={busy}
            style={{ marginTop: spacing.md }}
          />
          <Button
            label="Replace (delete existing and restore)"
            variant="destructive"
            onPress={() => onChoose('replace')}
            disabled={busy}
            style={{ marginTop: spacing.sm }}
          />
          <Button label="Cancel" variant="ghost" onPress={onClose} disabled={busy} style={{ marginTop: spacing.sm }} />
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  dialog: { width: '90%' }
});
