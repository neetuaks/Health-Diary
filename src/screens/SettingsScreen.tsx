import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, TextInput, StyleSheet } from 'react-native';
import { exportAllAsJSON, exportAllAsCSV } from '../services/dataExport';
import { exportDiagnostics } from '../services/diagnosticsLog';
import { getStoredRecoveryKey } from '../services/crypto';
import { tryAuthenticate } from '../services/deviceAuth';
import ConfirmDeleteAllModal from '../components/ConfirmDeleteAllModal';
import { getBackupReminderDays, setBackupReminderDays } from '../services/appSettings';
import { Screen, Card, Button, Banner } from '../theme/components';
import { colors, spacing, typography, radius } from '../theme/tokens';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={[typography.caption, styles.sectionLabel]}>{children}</Text>;
}

function Row({ label, onPress, destructive }: { label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.row}>
      <Text style={[typography.body, destructive && { color: colors.danger }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }: any) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [reminderDays, setReminderDaysState] = useState<number>(30);

  useEffect(() => {
    getBackupReminderDays().then(d => setReminderDaysState(d));
  }, []);

  const confirmUnencryptedExport = (label: string, run: () => void) => {
    Alert.alert(
      `Export ${label} (unencrypted)`,
      'This export is not encrypted, unlike your Backup file. Anyone with the exported file can read your data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export', onPress: run }
      ]
    );
  };

  const handleViewRecoveryKey = async () => {
    const ok = await tryAuthenticate('Authenticate to view Recovery Key');
    if (!ok) { Alert.alert('Authentication failed'); return; }
    const key = await getStoredRecoveryKey();
    Alert.alert('Recovery Key', key ?? 'No key stored on this device');
  };

  return (
    <Screen scroll>
      <Text style={typography.h1}>Settings</Text>

      <Banner variant="info" title="Your data never leaves your device" message="Health Diary has no backend, no accounts, and no analytics. Readings stay in local storage unless you explicitly export a file or back up to your own Google Drive." />

      <SectionLabel>Backup</SectionLabel>
      <Card>
        <Row label="Back Up & Restore" onPress={() => navigation.navigate('Backup')} />
        <Row label="Manage Google Drive Backups" onPress={() => navigation.navigate('DriveBackups')} />
        <View style={styles.rowGroup}>
          <Text style={typography.body}>Backup reminder frequency (days)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm }}>
            <TextInput
              value={String(reminderDays)}
              onChangeText={t => setReminderDaysState(Number(t) || 0)}
              style={styles.input}
              keyboardType="numeric"
            />
            <Button label="Save" onPress={async () => { await setBackupReminderDays(reminderDays); Alert.alert('Saved'); }} />
          </View>
        </View>
        <Row label="View Recovery Key" onPress={handleViewRecoveryKey} />
      </Card>

      <SectionLabel>Your Data</SectionLabel>
      <Card>
        <Row label="Export all data (JSON)" onPress={() => confirmUnencryptedExport('JSON', exportAllAsJSON)} />
        <Row label="Export all data (CSV)" onPress={() => confirmUnencryptedExport('CSV', exportAllAsCSV)} />
        <Row label="Report a Problem (Export Diagnostics)" onPress={() => exportDiagnostics()} />
      </Card>

      <SectionLabel>Danger Zone</SectionLabel>
      <Card>
        <Row label="Delete My Data (All)" destructive onPress={() => setDeleteModalOpen(true)} />
      </Card>
      <ConfirmDeleteAllModal visible={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.xs, textTransform: 'uppercase' as any },
  row: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowGroup: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, width: 80, backgroundColor: colors.surface }
});
