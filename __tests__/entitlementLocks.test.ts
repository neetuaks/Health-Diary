jest.mock('../src/db/init', () => require('../__mocks__/fakeDb'));

import {
  reconcileLocks,
  reconcileAndPersistProfileLocks,
  reconcileAndPersistParameterTypeLocks,
  lockProfile,
  unlockProfile,
} from '../src/services/entitlementLocks';

const { __fakeDb } = require('../__mocks__/fakeDb');

// PAYWALL-SPEC §7: a tier drop locks the excess over the new limit — never
// deletes it — and an upgrade unlocks it again. reconcileLocks is the pure
// core of that; the *AndPersist wrappers are exercised against the fakeDb so
// the "downgrade never deletes a row" guarantee is checked at the DB layer too.
describe('reconcileLocks (pure)', () => {
  test('under the limit: nothing is locked or unlocked', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    expect(reconcileLocks(items, 5)).toEqual({ toLock: [], toUnlock: [] });
  });

  test('a downgrade locks exactly the excess, keeping the given order for who stays active', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(reconcileLocks(items, 2)).toEqual({ toLock: ['c'], toUnlock: [] });
  });

  test('protectedId is always kept active even if it would otherwise be locked', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    // 'c' would be locked by plain order — protecting it locks 'b' instead.
    expect(reconcileLocks(items, 2, 'c')).toEqual({ toLock: ['b'], toUnlock: [] });
  });

  test('an upgrade unlocks previously-locked items up to the new limit', () => {
    const items = [{ id: 'a' }, { id: 'b', locked_at: '2024-01-01T00:00:00.000Z' }, { id: 'c', locked_at: '2024-01-01T00:00:00.000Z' }];
    expect(reconcileLocks(items, 3)).toEqual({ toLock: [], toUnlock: ['b', 'c'] });
  });

  test('an upgrade that still does not cover everyone unlocks only up to the new limit', () => {
    const items = [{ id: 'a' }, { id: 'b', locked_at: '2024-01-01T00:00:00.000Z' }, { id: 'c', locked_at: '2024-01-01T00:00:00.000Z' }];
    expect(reconcileLocks(items, 2)).toEqual({ toLock: [], toUnlock: ['b'] });
  });

  test('is idempotent: reconciling an already-consistent state changes nothing', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c', locked_at: '2024-01-01T00:00:00.000Z' }];
    expect(reconcileLocks(items, 2)).toEqual({ toLock: [], toUnlock: [] });
  });
});

describe('reconcileAndPersistProfileLocks (downgrade is non-destructive)', () => {
  beforeEach(() => {
    __fakeDb._reset();
    __fakeDb._seedProfiles([
      { id: 'p1', name: 'Alice', date_of_birth: null, glucose_unit_pref: 'mg/dL', weight_unit_pref: 'kg', last_backup_at: null, locked_at: null },
      { id: 'p2', name: 'Bob', date_of_birth: null, glucose_unit_pref: 'mg/dL', weight_unit_pref: 'kg', last_backup_at: null, locked_at: null },
      { id: 'p3', name: 'Cara', date_of_birth: null, glucose_unit_pref: 'mg/dL', weight_unit_pref: 'kg', last_backup_at: null, locked_at: null },
    ]);
    __fakeDb._seedReadings([
      { id: 'r1', profile_id: 'p2', parameter_type_id: 'bp', recorded_at: '2024-01-01T00:00:00.000Z', created_at: '2024-01-01T00:00:00.000Z', source: 'manual', vals: JSON.stringify({ systolic: 120, diastolic: 80 }), notes: null },
      { id: 'r2', profile_id: 'p3', parameter_type_id: 'bp', recorded_at: '2024-01-01T00:00:00.000Z', created_at: '2024-01-01T00:00:00.000Z', source: 'manual', vals: JSON.stringify({ systolic: 118, diastolic: 76 }), notes: null },
    ]);
  });

  test('locks profiles over the limit without deleting them or their readings', async () => {
    const profilesBefore = await __fakeDb.getAllAsync('SELECT * FROM profiles;');
    await reconcileAndPersistProfileLocks(profilesBefore, 1, 'p1');

    const profilesAfter = await __fakeDb.getAllAsync('SELECT * FROM profiles;');
    expect(profilesAfter.map((p: any) => p.id).sort()).toEqual(['p1', 'p2', 'p3']);
    expect(profilesAfter.find((p: any) => p.id === 'p1').locked_at).toBeFalsy();
    expect(profilesAfter.find((p: any) => p.id === 'p2').locked_at).toBeTruthy();
    expect(profilesAfter.find((p: any) => p.id === 'p3').locked_at).toBeTruthy();

    const readingsAfter = await __fakeDb.getAllAsync('SELECT * FROM readings;');
    expect(readingsAfter.map((r: any) => r.id).sort()).toEqual(['r1', 'r2']);
  });

  test('a later upgrade unlocks the locked profiles again', async () => {
    await lockProfile('p2');
    await lockProfile('p3');

    const profiles = await __fakeDb.getAllAsync('SELECT * FROM profiles;');
    await reconcileAndPersistProfileLocks(profiles, 3, 'p1');

    const after = await __fakeDb.getAllAsync('SELECT * FROM profiles;');
    expect(after.every((p: any) => !p.locked_at)).toBe(true);
  });
});

describe('reconcileAndPersistParameterTypeLocks', () => {
  beforeEach(() => {
    __fakeDb._reset();
    __fakeDb._seedParameterTypes([
      { id: 'bp', display_name: 'Blood Pressure', icon: null, color: null, is_builtin: 1, field_definitions: '[]', locked_at: null },
      { id: 'weight', display_name: 'Weight', icon: null, color: null, is_builtin: 0, field_definitions: '[]', locked_at: null },
      { id: 'mood', display_name: 'Mood', icon: null, color: null, is_builtin: 0, field_definitions: '[]', locked_at: null },
    ]);
  });

  test('locks excess custom types over the limit, never touching built-ins', async () => {
    const all = await __fakeDb.getAllAsync('SELECT * FROM parameter_types;');
    const customTypes = all.filter((t: any) => !t.is_builtin);
    await reconcileAndPersistParameterTypeLocks(customTypes, 1);

    const after = await __fakeDb.getAllAsync('SELECT * FROM parameter_types;');
    expect(after.find((t: any) => t.id === 'bp').locked_at).toBeFalsy();
    expect(after.find((t: any) => t.id === 'weight').locked_at).toBeFalsy();
    expect(after.find((t: any) => t.id === 'mood').locked_at).toBeTruthy();
    // still defined, not deleted
    expect(after.map((t: any) => t.id).sort()).toEqual(['bp', 'mood', 'weight']);
  });
});
