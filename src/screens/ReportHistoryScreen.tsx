import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchPdfHistory, deletePdfHistoryEntry, clearPdfHistory, PdfReportRecord } from '../services/pdfHistory';
import { downloadPdfToDevice } from '../services/pdfDownload';
import { useProfile } from '../services/profileContext';
import { Screen, Card, Button, EmptyState } from '../theme/components';
import { colors, spacing, typography } from '../theme/tokens';

export default function ReportHistoryScreen() {
  const { profiles } = useProfile();
  const [history, setHistory] = useState<PdfReportRecord[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(() => { fetchPdfHistory().then(setHistory); }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const profileNames = (ids: string[]) =>
    ids.map(id => profiles.find(p => p.id === id)?.name ?? 'Unknown profile').join(', ');

  const handleRedownload = async (entry: PdfReportRecord) => {
    setBusyId(entry.id);
    try {
      const result = await downloadPdfToDevice(entry.file_path, `healthdiary_report_${entry.id}.pdf`);
      if (!result.success) Alert.alert('Could not save', result.message ?? 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (entry: PdfReportRecord) => {
    Alert.alert('Delete this report', 'This removes it from your report history. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deletePdfHistoryEntry(entry.id); refresh(); } },
    ]);
  };

  const handleClearAll = () => {
    if (history.length === 0) return;
    Alert.alert('Clear report history', 'This deletes every saved report file on this device. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: async () => { await clearPdfHistory(); refresh(); } },
    ]);
  };

  return (
    <Screen>
      <Text style={typography.h1}>Report History</Text>
      <Text style={[typography.caption, { marginTop: spacing.xs }]}>
        Past PDF reports generated on this device. These stay here even if you later downgrade — only generating new ones requires Pro/Premium.
      </Text>

      <FlatList
        style={{ marginTop: spacing.lg }}
        data={history}
        keyExtractor={h => h.id}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={typography.bodyBold}>{item.type === 'consolidated' ? 'Family Report' : profileNames(item.profile_ids)}</Text>
              <Text style={typography.caption}>
                {new Date(item.generated_at).toLocaleString()}{item.date_range ? ` · ${item.date_range}` : ''}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button label="Save" size="sm" variant="secondary" disabled={busyId === item.id} onPress={() => handleRedownload(item)} />
              <Button label="Delete" size="sm" variant="destructive" onPress={() => handleDelete(item)} />
            </View>
          </Card>
        )}
        ListEmptyComponent={() => <EmptyState title="No reports yet" subtitle="Generated PDF reports will show up here." />}
      />

      {history.length > 0 && (
        <Button label="Clear All" variant="destructive" onPress={handleClearAll} style={{ marginTop: spacing.lg }} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
