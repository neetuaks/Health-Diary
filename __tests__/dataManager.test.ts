jest.mock('../src/db/init', () => require('../__mocks__/fakeDb'));

import { deleteAllData } from '../src/services/dataManager';
import { storeRecoveryKeyOnDevice, getStoredRecoveryKey } from '../src/services/crypto';

const { __fakeDb } = require('../__mocks__/fakeDb');
const FileSystem = require('expo-file-system/legacy');

describe('deleteAllData', () => {
  beforeEach(() => {
    __fakeDb._reset();
    FileSystem.getInfoAsync.mockReset();
    FileSystem.deleteAsync.mockClear();
  });

  test('clears profiles and readings', async () => {
    __fakeDb._seedProfiles([{ id: 'p1', name: 'Alice', date_of_birth: null, glucose_unit_pref: 'mg/dL', weight_unit_pref: 'kg', last_backup_at: null }]);
    __fakeDb._seedReadings([{ id: 'r1', profile_id: 'p1', parameter_type_id: 'bp', recorded_at: '2024-01-01T00:00:00.000Z', created_at: '2024-01-01T00:00:00.000Z', source: 'manual', vals: '{}', notes: null }]);

    await deleteAllData(false);

    expect(await __fakeDb.getAllAsync('SELECT * FROM profiles;')).toEqual([]);
    expect(await __fakeDb.getAllAsync('SELECT * FROM readings;')).toEqual([]);
  });

  test('deletes both the local safety copy and the shareable cache copy when asked to and they exist', async () => {
    FileSystem.getInfoAsync.mockResolvedValue({ exists: true });

    await deleteAllData(true);

    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(2);
    const deletedPaths = FileSystem.deleteAsync.mock.calls.map((c: any[]) => c[0]);
    expect(deletedPaths.some((p: string) => p.includes('backups/'))).toBe(true);
    expect(deletedPaths.some((p: string) => p === FileSystem.cacheDirectory + 'healthdiary_backup.json')).toBe(true);
  });

  test('does not delete backup files that do not exist, even when asked to', async () => {
    FileSystem.getInfoAsync.mockResolvedValue({ exists: false });

    await deleteAllData(true);

    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  test('leaves backup files alone when not asked to delete them, even if they exist', async () => {
    FileSystem.getInfoAsync.mockResolvedValue({ exists: true });

    await deleteAllData(false);

    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  test('leaves the Recovery Key untouched', async () => {
    FileSystem.getInfoAsync.mockResolvedValue({ exists: false });
    await storeRecoveryKeyOnDevice('ABCD-1234');

    await deleteAllData(true);

    expect(await getStoredRecoveryKey()).toBe('ABCD-1234');
  });
});
