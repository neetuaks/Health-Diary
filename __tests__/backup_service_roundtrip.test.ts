import { createEncryptedBackup, restoreEncryptedBackupFromFile, readLocalBackupCopy, localBackupCopyExists } from '../src/services/backup';

jest.mock('../src/db/init', () => require('../__mocks__/fakeDb'));

const { __fakeDb } = require('../__mocks__/fakeDb');
const FileSystem = require('expo-file-system');

describe('backup service roundtrip against real db column names', () => {
  beforeEach(() => {
    __fakeDb._reset();
    FileSystem.writeAsStringAsync.mockClear();
    FileSystem.getInfoAsync.mockClear();
    FileSystem.readAsStringAsync.mockClear();
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

    // Two writes: the shareable cache-directory copy (this test's concern), plus
    // the always-on, invisible local safety copy every backup also gets now (see
    // backupDestinations.ts) — the cache-directory write happens first.
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledTimes(2);
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

  test('createEncryptedBackup + restoreEncryptedBackupFromFile round-trips a custom parameter type intact', async () => {
    __fakeDb._seedProfiles([
      { id: 'p1', name: 'Alice', date_of_birth: null, glucose_unit_pref: 'mg/dL', weight_unit_pref: 'kg', last_backup_at: null }
    ]);
    __fakeDb._seedParameterTypes([
      {
        id: 'custom-weight-id',
        display_name: 'Weight',
        icon: null,
        color: null,
        is_builtin: 0,
        field_definitions: JSON.stringify([{ key: 'weight_kg', label: 'Weight', dataType: 'numeric', unit: 'kg', required: true }])
      }
    ]);

    await createEncryptedBackup();
    const [, containerJson] = FileSystem.writeAsStringAsync.mock.calls[0];

    const { getStoredRecoveryKey } = require('../src/services/crypto');
    const recovery = await getStoredRecoveryKey();

    __fakeDb._reset();
    const restored = await restoreEncryptedBackupFromFile(containerJson, recovery);

    const customType = restored.parameter_types.find((t: any) => t.id === 'custom-weight-id');
    expect(customType).toBeTruthy();
    expect(customType.is_builtin).toBe(0);
    expect(customType.field_definitions).toEqual([{ key: 'weight_kg', label: 'Weight', dataType: 'numeric', unit: 'kg', required: true }]);

    const persistedTypes = await __fakeDb.getAllAsync('SELECT * FROM parameter_types;');
    const persistedCustom = persistedTypes.find((t: any) => t.id === 'custom-weight-id');
    expect(persistedCustom).toBeTruthy();
    expect(JSON.parse(persistedCustom.field_definitions)).toEqual([{ key: 'weight_kg', label: 'Weight', dataType: 'numeric', unit: 'kg', required: true }]);
  });
});

describe('readLocalBackupCopy', () => {
  beforeEach(() => {
    FileSystem.getInfoAsync.mockClear();
    FileSystem.readAsStringAsync.mockClear();
  });

  test('returns null when no local backup file exists', async () => {
    FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: false });
    const content = await readLocalBackupCopy();
    expect(content).toBeNull();
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
  });

  test('returns the file content when a local backup exists', async () => {
    FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true });
    FileSystem.readAsStringAsync.mockResolvedValueOnce('{"version":1}');
    const content = await readLocalBackupCopy();
    expect(content).toBe('{"version":1}');
  });
});

describe('localBackupCopyExists', () => {
  beforeEach(() => {
    FileSystem.getInfoAsync.mockClear();
  });

  test('reflects whether the local backup file is present', async () => {
    FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: false });
    expect(await localBackupCopyExists()).toBe(false);

    FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true });
    expect(await localBackupCopyExists()).toBe(true);
  });
});
