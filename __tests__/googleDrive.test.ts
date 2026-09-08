import * as SecureStore from 'expo-secure-store';
import { getAccessToken, connectToGoogleDrive } from '../src/services/googleDriveBackup';

jest.mock('expo-secure-store');

describe('Google Drive token storage', () => {
  beforeEach(() => {
    (SecureStore.getItemAsync as jest.Mock).mockReset();
    (SecureStore.setItemAsync as jest.Mock).mockReset();
    (SecureStore.deleteItemAsync as jest.Mock).mockReset();
  });

  it('returns null when no token stored', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    const t = await getAccessToken();
    expect(t).toBeNull();
  });
});
