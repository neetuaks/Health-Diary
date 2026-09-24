import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import ConfirmDeleteAllModal from '../../src/components/ConfirmDeleteAllModal';

jest.mock('../../src/services/dataManager', () => ({ deleteAllData: jest.fn(async () => {}) }));
jest.mock('../../src/services/backup', () => ({ localBackupCopyExists: jest.fn(async () => false) }));

const mockReloadProfiles = jest.fn(async () => {});
jest.mock('../../src/services/profileContext', () => ({ useProfile: () => ({ reloadProfiles: mockReloadProfiles }) }));

const { deleteAllData } = require('../../src/services/dataManager');
const { localBackupCopyExists } = require('../../src/services/backup');

describe('ConfirmDeleteAllModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
  });

  test('Delete button is disabled until the user types DELETE', async () => {
    const onClose = jest.fn();
    await render(<ConfirmDeleteAllModal visible onClose={onClose} />);

    await fireEvent.press(screen.getByText('Delete'));

    expect(deleteAllData).not.toHaveBeenCalled();
  });

  test('typing DELETE with no local backup deletes data directly, without asking about a backup', async () => {
    const onClose = jest.fn();
    await render(<ConfirmDeleteAllModal visible onClose={onClose} />);

    await fireEvent.changeText(screen.getByDisplayValue(''), 'DELETE');
    await fireEvent.press(screen.getByText('Delete'));

    await waitFor(() => expect(deleteAllData).toHaveBeenCalledWith(false));
    expect(mockReloadProfiles).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    // No local backup exists, so the "also delete your backup?" question
    // should never be shown — asking would be meaningless.
    expect(Alert.alert).not.toHaveBeenCalledWith('Also delete your backup copy?', expect.anything(), expect.anything());
  });

  test('typing DELETE with a local backup present asks separately, and "Keep backup" preserves it', async () => {
    localBackupCopyExists.mockResolvedValueOnce(true);
    const onClose = jest.fn();
    await render(<ConfirmDeleteAllModal visible onClose={onClose} />);

    await fireEvent.changeText(screen.getByDisplayValue(''), 'DELETE');
    await fireEvent.press(screen.getByText('Delete'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    const [, , buttons] = (Alert.alert as jest.Mock).mock.calls.find(c => c[0] === 'Also delete your backup copy?');
    const keepButton = buttons.find((b: any) => b.text === 'Keep backup');
    await act(() => keepButton.onPress());

    expect(deleteAllData).toHaveBeenCalledWith(false);
  });

  test('choosing "Delete backup too" deletes the local backup as well', async () => {
    localBackupCopyExists.mockResolvedValueOnce(true);
    const onClose = jest.fn();
    await render(<ConfirmDeleteAllModal visible onClose={onClose} />);

    await fireEvent.changeText(screen.getByDisplayValue(''), 'DELETE');
    await fireEvent.press(screen.getByText('Delete'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    const [, , buttons] = (Alert.alert as jest.Mock).mock.calls.find(c => c[0] === 'Also delete your backup copy?');
    const deleteBackupButton = buttons.find((b: any) => b.text === 'Delete backup too');
    await act(() => deleteBackupButton.onPress());

    expect(deleteAllData).toHaveBeenCalledWith(true);
  });

  test('Cancel clears the input and closes without deleting anything', async () => {
    const onClose = jest.fn();
    await render(<ConfirmDeleteAllModal visible onClose={onClose} />);

    await fireEvent.changeText(screen.getByDisplayValue(''), 'DELETE');
    await fireEvent.press(screen.getByText('Cancel'));

    expect(onClose).toHaveBeenCalled();
    expect(deleteAllData).not.toHaveBeenCalled();
  });
});
