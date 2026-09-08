import * as G from '../src/services/googleDriveBackup';

describe('Google Drive backup helpers', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test('listBackupsFromDrive calls Drive API and returns files', async () => {
    jest.spyOn(G, 'getAccessToken' as any).mockResolvedValue('tok123');
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ files: [{ id: '1', name: 'a', createdTime: 't' }] }) }) as any;
    const res = await G.listBackupsFromDrive();
    expect(res.length).toBe(1);
    expect(res[0].name).toBe('a');
  });

  test('deleteBackupFromDrive issues DELETE and throws on failure', async () => {
    jest.spyOn(G, 'getAccessToken' as any).mockResolvedValue('tok123');
    global.fetch = jest.fn().mockResolvedValue({ ok: false, text: async () => 'err' }) as any;
    await expect(G.deleteBackupFromDrive('1')).rejects.toThrow('Delete failed');
  });
});
