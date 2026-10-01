import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import FirstRunKeyChoiceModal from '../../src/components/FirstRunKeyChoiceModal';

// Mirrors ProfileManager.test.tsx's mock set for the same reason: this modal
// pulls in backup.ts -> db/init.ts -> a real SQLite.openDatabaseSync() call,
// unavailable in this jest-expo component environment.
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
jest.mock('../../src/services/onboarding', () => ({ setOnboardingChoice: jest.fn(async () => {}) }));
jest.mock('../../src/services/profileContext', () => ({ useProfile: () => ({ reloadProfiles: jest.fn() }) }));

describe('FirstRunKeyChoiceModal welcome step (CLAUDE-CODE-PROMPT-legal-links.md §4)', () => {
  test('opens on the welcome/disclaimer step with the required content and a Continue button', async () => {
    await render(<FirstRunKeyChoiceModal visible onDone={() => {}} />);

    expect(await screen.findByText(/Your readings stay on this phone/)).toBeTruthy();
    expect(screen.getByText(/Make a backup now and then/)).toBeTruthy();
    expect(screen.getByText(/Readiva helps you keep a record of your readings/)).toBeTruthy();
    expect(screen.getByText('Terms of Service')).toBeTruthy();
    expect(screen.getByText('Privacy Policy')).toBeTruthy();
    // Only Terms + Privacy on this step, not the full three-link set.
    expect(screen.queryByText('Medical Disclaimer')).toBeNull();
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  test('tapping Continue moves past the welcome step to the new/existing choice, and welcome does not come back', async () => {
    await render(<FirstRunKeyChoiceModal visible onDone={() => {}} />);

    await screen.findByText('Continue');
    fireEvent.press(screen.getByText('Continue'));

    expect(await screen.findByText(/Have you used Readiva before/)).toBeTruthy();
    expect(screen.queryByText(/Your readings stay on this phone/)).toBeNull();
    expect(screen.queryByText('Continue')).toBeNull();
  });
});
