import { createEncryptedBackup, restoreEncryptedBackupFromFile } from '../src/services/backup';

jest.mock('../src/db/init', () => require('../__mocks__/fakeDb'));

const { __fakeDb } = require('../__mocks__/fakeDb');
const FileSystem = require('expo-file-system');

describe('backup service roundtrip against real db column names', () => {
  beforeEach(() => {
    __fakeDb._reset();
    FileSystem.writeAsStringAsync.mockClear();
  });

  test('createEncryptedBackup + restoreEncryptedBackupFromFile preserves reading vals', async () => {
    __fakeDb._seedProfiles([
      { id: 'p1', name: 'Alice', date_of_birth: null, glucose_unit_pref: 'mg/dL', weight_unit_pref: 'kg', last_backup_at: null }
    ]);
    __fakeDb._seedReadings([
      {
        id: 'r1',
        profile_id: 'p1',
        parameter_type_id: 'bp',
        recorded_at: '2024-01-01T00:00:00.000Z',
        created_at: '2024-01-01T00:00:00.000Z',
        source: 'manual',
        vals: JSON.stringify({ systolic: 120, diastolic: 80 }),
        notes: null
      }
    ]);

    await createEncryptedBackup();

    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledTimes(1);
    const [, containerJson] = FileSystem.writeAsStringAsync.mock.calls[0];
    expect(containerJson).toBeTruthy();

    const { getStoredRecoveryKey } = require('../src/services/crypto');
    const recovery = await getStoredRecoveryKey();
    expect(recovery).toBeTruthy();

    // Simulate restoring onto a clean device.
    __fakeDb._reset();
    const restored = await restoreEncryptedBackupFromFile(containerJson, recovery);

    expect(restored.readings[0].vals).toEqual({ systolic: 120, diastolic: 80 });

    const persisted = await __fakeDb.getAllAsync('SELECT * FROM readings;');
    expect(JSON.parse(persisted[0].vals)).toEqual({ systolic: 120, diastolic: 80 });
  });
});
