import React, { useEffect, useState } from 'react';
import { View, Text, Alert, TextInput, StyleSheet } from 'react-native';
import { exportAllAsJSON, exportAllAsCSV } from '../services/dataExport';
import { emailDiagnostics } from '../services/diagnosticsLog';
import ConfirmDeleteAllModal from '../components/ConfirmDeleteAllModal';
import { getBackupReminderDays, setBackupReminderDays } from '../services/appSettings';
import { Screen, Card, Button, Banner, ListButton } from '../theme/components';
import { colors, spacing, typography, radius } from '../theme/tokens';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={[typography.caption, styles.sectionLabel]}>{children}</Text>;
}

const divider = { borderBottomWidth: 1, borderBottomColor: colors.border };

export default function SettingsScreen({ navigation }: any) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [reminderDays, setReminderDaysState] = useState<number>(30);

  useEffect(() => {
    getBackupReminderDays().then(d => setReminderDaysState(d));
  }, []);

  const confirmUnencryptedExport = (label: string, run: () => Promise<void>) => {
    Alert.alert(
      `Export ${label} (unencrypted)`,
      'This export is not encrypted, unlike your Backup file. Anyone with the exported file can read your data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export', onPress: () => run().catch((e: any) => Alert.alert('Export failed', e?.message ?? 'Please try again.')) }
      ]
    );
  };

  return (
    <Screen scroll topInset={false}>
      <Text style={typography.h1}>Settings</Text>

      <Banner variant="info" title="Your data never leaves your device" message="Health Diary has no backend, no accounts, and no analytics. Readings stay in local storage unless you explicitly export or share them." />

      <SectionLabel>Backup</SectionLabel>
      <Card style={{ padding: 0, paddingHorizontal: spacing.lg }}>
        <ListButton label="Back Up & Restore" subtitle="Encrypted backup, recovery key, restore" onPress={() => navigation.navigate('Backup')} style={divider} />
        <View style={styles.rowGroup}>
          <Text style={typography.body}>Backup reminder frequency (days)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm }}>
            <TextInput
              value={String(reminderDays)}
              onChangeText={t => setReminderDaysState(Number(t) || 0)}
              style={styles.input}
              keyboardType="numeric"
            />
            <Button label="Save" size="sm" onPress={async () => { await setBackupReminderDays(reminderDays); Alert.alert('Saved'); }} />
          </View>
        </View>
      </Card>

      <SectionLabel>Your Data</SectionLabel>
      <Card style={{ padding: 0, paddingHorizontal: spacing.lg }}>
        <ListButton label="Export all data (JSON)" onPress={() => confirmUnencryptedExport('JSON', exportAllAsJSON)} style={divider} />
        <ListButton label="Export all data (CSV)" onPress={() => confirmUnencryptedExport('CSV', exportAllAsCSV)} style={divider} />
        <ListButton
          label="Report a Problem (Email Diagnostics)"
          subtitle="Technical log only, not your data — opens your email app to send it"
          onPress={() => emailDiagnostics()}
        />
      </Card>

      <SectionLabel>Danger Zone</SectionLabel>
      <Card style={{ padding: 0, paddingHorizontal: spacing.lg }}>
        <ListButton label="Delete My Data (All)" destructive onPress={() => setDeleteModalOpen(true)} />
      </Card>
      <ConfirmDeleteAllModal visible={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.xs, textTransform: 'uppercase' as any },
  rowGroup: { paddingVertical: spacing.md },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, width: 80, backgroundColor: colors.surface }
});
