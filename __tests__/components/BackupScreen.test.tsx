import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import BackupScreen from '../../src/screens/BackupScreen';

jest.mock('../../src/services/crypto', () => ({
  generateRecoveryKey: jest.fn(async () => 'NEW-KEY-0001'),
  storeRecoveryKeyOnDevice: jest.fn(async () => {}),
  getStoredRecoveryKey: jest.fn(async () => null),
  getRecoveryKeyConfirmed: jest.fn(async () => false),
  setRecoveryKeyConfirmed: jest.fn(async () => {}),
}));
jest.mock('../../src/services/backup', () => ({
  createEncryptedBackup: jest.fn(async () => ({ uri: 'file:///backup.json' })),
  peekEncryptedBackup: jest.fn(async () => ({ profiles: [] })),
  restoreEncryptedBackupFromFile: jest.fn(async () => ({})),
  readLocalBackupCopy: jest.fn(async () => null),
}));
jest.mock('../../src/services/pdf', () => ({ generateRecoveryKeyPDF: jest.fn(async () => 'file:///key.pdf') }));
jest.mock('../../src/services/pickAndReadBackupFile', () => ({ pickAndReadBackupFile: jest.fn(async () => null) }));
jest.mock('../../src/services/deviceAuth', () => ({ tryAuthenticate: jest.fn(async () => true) }));
jest.mock('../../src/services/share', () => ({ shareFile: jest.fn(async () => true) }));
jest.mock('../../src/db/init', () => ({ getDB: () => ({ getAllAsync: jest.fn(async () => []) }) }));

const mockReloadProfiles = jest.fn(async () => {});
jest.mock('../../src/services/profileContext', () => ({ useProfile: () => ({ reloadProfiles: mockReloadProfiles }) }));

const crypto = require('../../src/services/crypto');
const backup = require('../../src/services/backup');
const { tryAuthenticate } = require('../../src/services/deviceAuth');
const { pickAndReadBackupFile } = require('../../src/services/pickAndReadBackupFile');

describe('BackupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    crypto.getStoredRecoveryKey.mockResolvedValue(null);
    crypto.getRecoveryKeyConfirmed.mockResolvedValue(false);
    backup.readLocalBackupCopy.mockResolvedValue(null);
    tryAuthenticate.mockResolvedValue(true);
    jest.spyOn(Alert, 'alert');
  });

  test('with no key yet, shows Generate Recovery Key and no restore automation', async () => {
    await render(<BackupScreen />);

    expect(await screen.findByText('Generate Recovery Key')).toBeTruthy();
    expect(screen.queryByText('Restore from Device Backup')).toBeNull();
    expect(screen.getByText(/New device\? Enter the Recovery Key/)).toBeTruthy();
  });

  test('an unconfirmed key is shown in full, with a confirm action', async () => {
    crypto.getStoredRecoveryKey.mockResolvedValue('ABCD-1234');
    crypto.getRecoveryKeyConfirmed.mockResolvedValue(false);
    await render(<BackupScreen />);

    expect(await screen.findByText('ABCD-1234')).toBeTruthy();

    await fireEvent.press(screen.getByText("I've saved my key"));
    await waitFor(() => expect(crypto.setRecoveryKeyConfirmed).toHaveBeenCalledWith(true));
  });

  test('a confirmed key is hidden, showing only a confirmed status', async () => {
    crypto.getStoredRecoveryKey.mockResolvedValue('ABCD-1234');
    crypto.getRecoveryKeyConfirmed.mockResolvedValue(true);
    await render(<BackupScreen />);

    await screen.findByText('Recovery Key saved and confirmed.');
    expect(screen.queryByText('ABCD-1234')).toBeNull();
  });

  test('when a local backup exists, restore is automatic and requires no key entry', async () => {
    backup.readLocalBackupCopy.mockResolvedValue('{"version":1}');
    await render(<BackupScreen />);

    const restoreButton = await screen.findByText('Restore from Device Backup');
    await fireEvent.press(restoreButton);

    await waitFor(() => expect(tryAuthenticate).toHaveBeenCalled());
    await waitFor(() => expect(backup.restoreEncryptedBackupFromFile).toHaveBeenCalledWith('{"version":1}', undefined));
    expect(mockReloadProfiles).toHaveBeenCalled();
    expect(pickAndReadBackupFile).not.toHaveBeenCalled();
  });

  test('when no local backup exists, restore falls back to manual file pick with a typed key', async () => {
    pickAndReadBackupFile.mockResolvedValue('{"version":1}');
    await render(<BackupScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('Recovery Key'), 'TYPED-KEY');
    await fireEvent.press(screen.getByText('Choose Backup File & Restore'));

    await waitFor(() => expect(pickAndReadBackupFile).toHaveBeenCalled());
    await waitFor(() => expect(backup.restoreEncryptedBackupFromFile).toHaveBeenCalledWith('{"version":1}', 'TYPED-KEY'));
  });
});
