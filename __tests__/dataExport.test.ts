jest.mock('../src/db/init', () => require('../__mocks__/fakeDb'));

import { exportAllAsJSON, exportAllAsCSV } from '../src/services/dataExport';

const { __fakeDb } = require('../__mocks__/fakeDb');
const FileSystem = require('expo-file-system');

describe('dataExport (guards against the values/vals mismatch that crashed both exports)', () => {
  beforeEach(() => {
    __fakeDb._reset();
    FileSystem.writeAsStringAsync.mockClear();
    __fakeDb._seedProfiles([{ id: 'p1', name: 'Alice', date_of_birth: null, glucose_unit_pref: 'mg/dL', weight_unit_pref: 'kg', last_backup_at: null }]);
    __fakeDb._seedReadings([
      { id: 'r1', profile_id: 'p1', parameter_type_id: 'bp', recorded_at: '2024-01-01T00:00:00.000Z', created_at: '2024-01-01T00:00:00.000Z', source: 'manual', vals: JSON.stringify({ systolic: 120, diastolic: 80 }), notes: null }
    ]);
  });

  test('exportAllAsJSON does not throw and contains parsed vals', async () => {
    await exportAllAsJSON();

    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledTimes(1);
    const [, content] = FileSystem.writeAsStringAsync.mock.calls[0];
    const payload = JSON.parse(content);
    expect(payload.readings[0].vals).toEqual({ systolic: 120, diastolic: 80 });
  });

  test('exportAllAsCSV does not throw and contains the vals JSON blob', async () => {
    await exportAllAsCSV();

    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledTimes(1);
    const [, content] = FileSystem.writeAsStringAsync.mock.calls[0];
    expect(content).toContain('systolic');
    expect(content).toContain('80');
  });
});

describe('dataExport export window (PAYWALL-SPEC §4.4 — Free caps export to the last N days)', () => {
  beforeEach(() => {
    __fakeDb._reset();
    FileSystem.writeAsStringAsync.mockClear();
    __fakeDb._seedProfiles([{ id: 'p1', name: 'Alice', date_of_birth: null, glucose_unit_pref: 'mg/dL', weight_unit_pref: 'kg', last_backup_at: null }]);
    const now = new Date();
    const recent = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const old = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    __fakeDb._seedReadings([
      { id: 'r-recent', profile_id: 'p1', parameter_type_id: 'bp', recorded_at: recent, created_at: recent, source: 'manual', vals: JSON.stringify({ systolic: 120, diastolic: 80 }), notes: null },
      { id: 'r-old', profile_id: 'p1', parameter_type_id: 'bp', recorded_at: old, created_at: old, source: 'manual', vals: JSON.stringify({ systolic: 118, diastolic: 76 }), notes: null }
    ]);
  });

  test('a 7-day window (Free) excludes readings older than 7 days from JSON export', async () => {
    await exportAllAsJSON(7);
    const [, content] = FileSystem.writeAsStringAsync.mock.calls[0];
    const payload = JSON.parse(content);
    expect(payload.readings.map((r: any) => r.id)).toEqual(['r-recent']);
  });

  test('a 7-day window (Free) excludes readings older than 7 days from CSV export', async () => {
    await exportAllAsCSV(7);
    const [, content] = FileSystem.writeAsStringAsync.mock.calls[0];
    expect(content).toContain('r-recent');
    expect(content).not.toContain('r-old');
  });

  test('null window (Pro/Premium) includes every reading regardless of age', async () => {
    await exportAllAsJSON(null);
    const [, content] = FileSystem.writeAsStringAsync.mock.calls[0];
    const payload = JSON.parse(content);
    expect(payload.readings.map((r: any) => r.id).sort()).toEqual(['r-old', 'r-recent']);
  });
});
