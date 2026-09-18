import { pickAndReadBackupFile } from '../src/services/pickAndReadBackupFile';

const DocumentPicker = require('expo-document-picker');
const FileSystem = require('expo-file-system/legacy');

describe('pickAndReadBackupFile', () => {
  beforeEach(() => {
    DocumentPicker.getDocumentAsync.mockClear();
    FileSystem.readAsStringAsync.mockClear();
    DocumentPicker.getDocumentAsync.mockResolvedValue({ canceled: true, assets: null });
  });

  test('returns null when the picker is cancelled', async () => {
    const content = await pickAndReadBackupFile();
    expect(content).toBeNull();
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
  });

  test('decodes the base64-read file content as utf8', async () => {
    DocumentPicker.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///picked.json' }] });
    const base64 = Buffer.from('{"version":1}', 'utf8').toString('base64');
    FileSystem.readAsStringAsync.mockResolvedValueOnce(base64);

    const content = await pickAndReadBackupFile();

    expect(content).toBe('{"version":1}');
    expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith('file:///picked.json', { encoding: 'base64' });
  });

  test('throws with the uri included after exhausting retries on a persistent read failure', async () => {
    DocumentPicker.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///picked.json' }] });
    FileSystem.readAsStringAsync.mockRejectedValue(new Error('not readable'));

    await expect(pickAndReadBackupFile()).rejects.toThrow(/not readable.*file:\/\/\/picked\.json/);
  }, 15000);
});
