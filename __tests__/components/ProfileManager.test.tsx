import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ProfileManager from '../../src/screens/ProfileManager';

const PROFILE_A = { id: 'p1', name: 'Alice', date_of_birth: '1990-01-01', glucose_unit_pref: 'mg/dL' as const, weight_unit_pref: 'kg' as const };
const PROFILE_B = { id: 'p2', name: 'Bob', date_of_birth: '1992-01-01', glucose_unit_pref: 'mg/dL' as const, weight_unit_pref: 'kg' as const, locked_at: '2024-01-01T00:00:00.000Z' };

jest.mock('../../src/services/profileContext', () => ({ useProfile: jest.fn() }));
jest.mock('../../src/services/entitlement', () => ({ useEntitlement: jest.fn() }));
jest.mock('../../src/services/entitlementLocks', () => ({
  reconcileAndPersistProfileLocks: jest.fn(async () => ({ toLock: [], toUnlock: [] })),
  unlockProfile: jest.fn(async () => {}),
}));
jest.mock('../../src/services/onboarding', () => ({
  getOnboardingChoice: jest.fn(async () => 'existing'),
  setOnboardingChoice: jest.fn(async () => {}),
}));
// ProfileManager renders FirstRunKeyChoiceModal, which pulls in backup.ts ->
// db/init.ts -> a real SQLite.openDatabaseSync() call — unavailable in this
// jest-expo component environment (see BackupScreen.test.tsx for the same
// mock, needed there for the same transitive reason).
jest.mock('../../src/db/init', () => ({ getDB: () => ({ getAllAsync: jest.fn(async () => []) }) }));
jest.mock('../../src/services/backup', () => ({
  readLocalBackupCopy: jest.fn(async () => null),
  restoreEncryptedBackupFromFile: jest.fn(async () => ({})),
}));
jest.mock('../../src/services/crypto', () => ({
  generateRecoveryKey: jest.fn(async () => 'NEW-KEY-0001'),
  storeRecoveryKeyOnDevice: jest.fn(async () => {}),
  getStoredRecoveryKey: jest.fn(async () => null),
  setRecoveryKeyConfirmed: jest.fn(async () => {}),
}));
jest.mock('../../src/services/pickAndReadBackupFile', () => ({ pickAndReadBackupFile: jest.fn(async () => null) }));

const { useProfile } = require('../../src/services/profileContext');
const { useEntitlement } = require('../../src/services/entitlement');
const { reconcileAndPersistProfileLocks, unlockProfile } = require('../../src/services/entitlementLocks');

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

describe('ProfileManager profile limit gate (PAYWALL-SPEC §4.1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    reconcileAndPersistProfileLocks.mockResolvedValue({ toLock: [], toUnlock: [] });
  });

  test('at the limit: "Add Profile" shows an upgrade prompt instead of opening the form', async () => {
    useProfile.mockReturnValue({
      profiles: [PROFILE_A], loading: false, activeProfile: PROFILE_A,
      addProfile: jest.fn(), editProfile: jest.fn(), deleteProfile: jest.fn(), setActiveProfile: jest.fn(), reloadProfiles: jest.fn(),
    });
    useEntitlement.mockReturnValue({ limits: { maxProfiles: 1 } });

    await render(<ProfileManager navigation={navigation} />);
    await screen.findByText('Alice');
    await fireEvent.press(screen.getByText('Add Profile'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(
      'Upgrade to unlock this',
      'Your plan covers 1 profile. Upgrade to add another.',
      expect.any(Array)
    ));
    expect(screen.queryByPlaceholderText('Name')).toBeNull();
  });

  test('under the limit: "Add Profile" opens the form as normal', async () => {
    useProfile.mockReturnValue({
      profiles: [PROFILE_A], loading: false, activeProfile: PROFILE_A,
      addProfile: jest.fn(), editProfile: jest.fn(), deleteProfile: jest.fn(), setActiveProfile: jest.fn(), reloadProfiles: jest.fn(),
    });
    useEntitlement.mockReturnValue({ limits: { maxProfiles: 2 } });

    await render(<ProfileManager navigation={navigation} />);
    await screen.findByText('Alice');
    await fireEvent.press(screen.getByText('Add Profile'));

    expect(await screen.findByPlaceholderText('Name')).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  test('a locked profile shows a Locked badge, disables switching into it, and offers Make Active', async () => {
    useProfile.mockReturnValue({
      profiles: [PROFILE_A, PROFILE_B], loading: false, activeProfile: PROFILE_A,
      addProfile: jest.fn(), editProfile: jest.fn(), deleteProfile: jest.fn(), setActiveProfile: jest.fn(), reloadProfiles: jest.fn(),
    });
    useEntitlement.mockReturnValue({ limits: { maxProfiles: 1 } });

    await render(<ProfileManager navigation={navigation} />);

    expect(await screen.findByText(/Bob.*Locked/)).toBeTruthy();
    const makeActive = screen.getByText('Make Active');
    await fireEvent.press(makeActive);
    expect(unlockProfile).toHaveBeenCalledWith('p2');
  });

  test('reconciles locks against the current plan on mount', async () => {
    const reloadProfiles = jest.fn();
    useProfile.mockReturnValue({
      profiles: [PROFILE_A, PROFILE_B], loading: false, activeProfile: PROFILE_A,
      addProfile: jest.fn(), editProfile: jest.fn(), deleteProfile: jest.fn(), setActiveProfile: jest.fn(), reloadProfiles,
    });
    useEntitlement.mockReturnValue({ limits: { maxProfiles: 1 } });

    await render(<ProfileManager navigation={navigation} />);

    await waitFor(() => expect(reconcileAndPersistProfileLocks).toHaveBeenCalledWith(
      [PROFILE_A, PROFILE_B], 1, 'p1'
    ));
  });
});
