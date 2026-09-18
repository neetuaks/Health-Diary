import { writeBackupToConfiguredDestinations } from '../src/services/backupDestinations';

const FileSystem = require('expo-file-system/legacy');

// No platform branching left here — the local safety copy is plain
// expo-file-system with no SAF/platform-specific API involved, so this suite
// covers both iOS and Android with the same assertions.
describe('backupDestinations', () => {
  beforeEach(() => {
    FileSystem.writeAsStringAsync.mockClear();
  });

  test('always writes the local safety copy', async () => {
    const result = await writeBackupToConfiguredDestinations('{"a":1}', 'backup.json');
    expect(result.local.ok).toBe(true);
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledTimes(1);
  });

  test('a local safety-copy failure is reported without throwing', async () => {
    FileSystem.writeAsStringAsync.mockRejectedValueOnce(new Error('disk full'));
    const result = await writeBackupToConfiguredDestinations('{"a":1}', 'backup.json');
    expect(result.local.ok).toBe(false);
    expect(result.local.error).toBe('disk full');
  });
});
