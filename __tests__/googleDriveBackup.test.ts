import * as G from '../src/services/googleDriveBackup';

describe('Google Drive backup helpers', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test('listBackupsFromDrive calls Drive API and returns files', async () => {
    // set a token in the SecureStore mock
    global.__EXPO_SECURE_STORE_STORE = global.__EXPO_SECURE_STORE_STORE || {};
    global.__EXPO_SECURE_STORE_STORE['healthdiary_google_drive_token_v2'] = JSON.stringify({ accessToken: 'tok123', expiresAt: Date.now() + 10000 });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ files: [{ id: '1', name: 'a', createdTime: 't' }] }) }) as any;
    const res = await G.listBackupsFromDrive();
    expect(res.length).toBe(1);
    expect(res[0].name).toBe('a');
  });

  test('deleteBackupFromDrive issues DELETE and throws on failure', async () => {
    global.__EXPO_SECURE_STORE_STORE = global.__EXPO_SECURE_STORE_STORE || {};
    global.__EXPO_SECURE_STORE_STORE['healthdiary_google_drive_token_v2'] = JSON.stringify({ accessToken: 'tok123', expiresAt: Date.now() + 10000 });
    global.fetch = jest.fn().mockResolvedValue({ ok: false, text: async () => 'err' }) as any;
    await expect(G.deleteBackupFromDrive('1')).rejects.toThrow('Delete failed');
  });
});
