import React, { useEffect, useState } from 'react';
import { View, Text, Alert, TextInput, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { exportAllAsJSON, exportAllAsCSV } from '../services/dataExport';
import { emailDiagnostics } from '../services/diagnosticsLog';
import { useEntitlement } from '../services/entitlement';
import { TIER_DISPLAY_NAME, Tier } from '../services/limits';
import { APP_NAME, SUPPORT_EMAIL, openLegalUrl } from '../config/legal';
import ConfirmDeleteAllModal from '../components/ConfirmDeleteAllModal';
import { getBackupReminderDays, setBackupReminderDays } from '../services/appSettings';
import { Screen, Card, Button, Banner, ListButton } from '../theme/components';
import { colors, spacing, typography, radius } from '../theme/tokens';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={[typography.caption, styles.sectionLabel]}>{children}</Text>;
}

const divider = { borderBottomWidth: 1, borderBottomColor: colors.border };

export default function SettingsScreen({ navigation }: any) {
  const { tier, limits, debugTierOverride, setDebugTier } = useEntitlement();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [reminderDays, setReminderDaysState] = useState<number>(30);
  const appVersion = Constants.expoConfig?.version;

  const openSupportEmail = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() =>
      Alert.alert("Couldn't open the page", 'Please check your internet connection and try again.')
    );
  };

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

      <Banner variant="info" title="Your data never leaves your device" message={`${APP_NAME} has no backend, no accounts, and no analytics. Readings stay in local storage unless you explicitly export or share them.`} />

      <SectionLabel>Plan</SectionLabel>
      <Card style={{ padding: 0, paddingHorizontal: spacing.lg }}>
        <ListButton
          label={`${TIER_DISPLAY_NAME[tier]} plan`}
          subtitle={tier === 'free' ? 'Upgrade for full history, custom parameters, and PDF reports' : 'Manage your subscription'}
          onPress={() => navigation.navigate('Paywall')}
        />
      </Card>

      {__DEV__ && (
        <>
          <SectionLabel>Debug (dev builds only)</SectionLabel>
          <Card style={{ padding: 0, paddingHorizontal: spacing.lg }}>
            <View style={{ paddingVertical: spacing.md }}>
              <Text style={typography.body}>
                Force a tier locally to test Pro/Premium gates — bypasses RevenueCat entirely.
                {debugTierOverride ? ` Currently forced to ${TIER_DISPLAY_NAME[debugTierOverride]}.` : ' Not overridden — using the real subscription state.'}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' }}>
                {(['free', 'pro', 'premium'] as Tier[]).map(t => (
                  <Button
                    key={t}
                    label={TIER_DISPLAY_NAME[t]}
                    size="sm"
                    variant={debugTierOverride === t ? 'primary' : 'secondary'}
                    onPress={() => setDebugTier(t)}
                  />
                ))}
                <Button
                  label="Clear override"
                  size="sm"
                  variant="ghost"
                  onPress={() => setDebugTier(null)}
                />
              </View>
            </View>
          </Card>
        </>
      )}

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

      <SectionLabel>Parameters</SectionLabel>
      <Card style={{ padding: 0, paddingHorizontal: spacing.lg }}>
        <ListButton
          label="Manage Parameter Types"
          subtitle="Blood Pressure, Glucose, and any custom types you add"
          onPress={() => navigation.navigate('Parameters')}
        />
      </Card>

      <SectionLabel>Your Data</SectionLabel>
      <Card style={{ padding: 0, paddingHorizontal: spacing.lg }}>
        <ListButton
          label="Export all data (JSON)"
          subtitle={limits.exportWindowDays !== null ? `Free export covers the last ${limits.exportWindowDays} days. Upgrade for full history.` : undefined}
          onPress={() => confirmUnencryptedExport('JSON', () => exportAllAsJSON(limits.exportWindowDays))}
          style={divider}
        />
        <ListButton
          label="Export all data (CSV)"
          subtitle={limits.exportWindowDays !== null ? `Free export covers the last ${limits.exportWindowDays} days. Upgrade for full history.` : undefined}
          onPress={() => confirmUnencryptedExport('CSV', () => exportAllAsCSV(limits.exportWindowDays))}
          style={divider}
        />
        <ListButton
          label="Report a Problem (Email Diagnostics)"
          subtitle="Technical log only, not your data — opens your email app to send it"
          onPress={() => emailDiagnostics()}
        />
      </Card>

      <SectionLabel>About</SectionLabel>
      <Card style={{ padding: 0, paddingHorizontal: spacing.lg }}>
        <ListButton label="Privacy Policy" onPress={() => openLegalUrl('privacy')} style={divider} />
        <ListButton label="Terms of Service" onPress={() => openLegalUrl('terms')} style={divider} />
        <ListButton label="Medical Disclaimer" onPress={() => openLegalUrl('disclaimer')} style={divider} />
        <ListButton label="Support" subtitle={SUPPORT_EMAIL} onPress={openSupportEmail} />
        <View style={[{ paddingBottom: spacing.sm }, divider]}>
          <TouchableOpacity onPress={() => openLegalUrl('support')} accessibilityRole="link" accessibilityLabel="Visit support page">
            <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>Visit support page</Text>
          </TouchableOpacity>
        </View>
        {appVersion ? (
          <Text style={[typography.caption, { paddingTop: spacing.sm }]}>{APP_NAME} version {appVersion}</Text>
        ) : null}
        <Text style={[typography.caption, { paddingTop: spacing.xs, paddingBottom: spacing.sm }]}>Your data stays on your device.</Text>
      </Card>

      <SectionLabel>Danger Zone</SectionLabel>
      <Card style={{ padding: 0, paddingHorizontal: spacing.lg }}>
        <ListButton
          label="Delete Multiple Readings"
          subtitle="By date range, parameter, or profile"
          destructive
          onPress={() => navigation.navigate('BulkDelete')}
          style={divider}
        />
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
