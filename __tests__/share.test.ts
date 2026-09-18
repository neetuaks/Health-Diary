jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() }
}));

import { shareFile } from '../src/services/share';
import { Alert } from 'react-native';

const Sharing = require('expo-sharing');

describe('shareFile (never throws — a share failure must not become an unhandled rejection)', () => {
  beforeEach(() => {
    Sharing.isAvailableAsync.mockReset();
    Sharing.shareAsync.mockReset();
    (Alert.alert as jest.Mock).mockReset();
  });

  test('returns true and calls shareAsync when sharing is available', async () => {
    Sharing.isAvailableAsync.mockResolvedValue(true);
    Sharing.shareAsync.mockResolvedValue(undefined);

    const ok = await shareFile('file:///tmp/x.txt', 'Title');
    expect(ok).toBe(true);
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///tmp/x.txt', { dialogTitle: 'Title' });
  });

  test('returns false, shows an alert, and does not throw when sharing is unavailable', async () => {
    Sharing.isAvailableAsync.mockResolvedValue(false);

    const ok = await shareFile('file:///tmp/x.txt');
    expect(ok).toBe(false);
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Sharing not available', expect.any(String));
  });

  test('returns false, shows an alert, and does not throw when shareAsync rejects', async () => {
    Sharing.isAvailableAsync.mockResolvedValue(true);
    Sharing.shareAsync.mockRejectedValue(new Error('Not allowed to read file under given URL.'));

    await expect(shareFile('file:///tmp/x.txt')).resolves.toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Could not share file', 'Not allowed to read file under given URL.');
  });
});
