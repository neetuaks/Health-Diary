import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import SettingsScreen from '../../src/screens/SettingsScreen';
import { LEGAL_URLS, SUPPORT_EMAIL } from '../../src/config/legal';

const { Linking } = require('react-native');

// SettingsScreen renders ConfirmDeleteAllModal unconditionally (just hidden via
// the Modal's own `visible` prop), which pulls in dataManager.ts/backup.ts and
// transitively db/init.ts -> a real SQLite.openDatabaseSync() call — unavailable
// in this jest-expo component environment (same reasoning as other component
// tests that touch these screens, e.g. ProfileManager.test.tsx).
jest.mock('../../src/db/init', () => ({ getDB: () => ({ getAllAsync: jest.fn(async () => []) }) }));
jest.mock('../../src/services/dataManager', () => ({ deleteAllData: jest.fn(async () => {}) }));
jest.mock('../../src/services/backup', () => ({ localBackupCopyExists: jest.fn(async () => false) }));
jest.mock('../../src/services/profileContext', () => ({ useProfile: () => ({ reloadProfiles: jest.fn() }) }));
jest.mock('../../src/services/appSettings', () => ({
  getBackupReminderDays: jest.fn(async () => 30),
  setBackupReminderDays: jest.fn(async () => {}),
}));
jest.mock('../../src/services/entitlement', () => ({
  useEntitlement: () => ({
    tier: 'free',
    limits: { exportWindowDays: 7 },
    debugTierOverride: null,
    setDebugTier: jest.fn(),
  }),
}));

const navigation = { navigate: jest.fn() };

describe('SettingsScreen About section (CLAUDE-CODE-PROMPT-legal-links.md §3)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders the three legal links and the support row, each opening the right destination', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

    await render(<SettingsScreen navigation={navigation} />);

    expect(await screen.findByText('Privacy Policy')).toBeTruthy();
    expect(screen.getByText('Terms of Service')).toBeTruthy();
    expect(screen.getByText('Medical Disclaimer')).toBeTruthy();
    expect(screen.getByText('Support')).toBeTruthy();
    expect(screen.getByText(SUPPORT_EMAIL)).toBeTruthy();
    expect(screen.getByText('Your data stays on your device.')).toBeTruthy();

    fireEvent.press(screen.getByText('Privacy Policy'));
    await waitFor(() => expect(openSpy).toHaveBeenCalledWith(LEGAL_URLS.privacy));

    fireEvent.press(screen.getByText('Support'));
    await waitFor(() => expect(openSpy).toHaveBeenCalledWith(`mailto:${SUPPORT_EMAIL}`));
  });
});
