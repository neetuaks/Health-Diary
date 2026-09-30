jest.mock('../src/db/init', () => require('../__mocks__/fakeDb'));

import {
  fetchParameterTypesForProfile,
  fetchProfileParameterTypeIds,
  addParameterTypeToProfile,
  removeParameterTypeFromProfile,
  assignParameterTypeToProfiles,
  backfillLegacyCustomParameterTypeScoping
} from '../src/services/profileParameterTypes';

const { __fakeDb } = require('../__mocks__/fakeDb');

const builtinBp = {
  id: 'bp',
  display_name: 'Blood Pressure',
  icon: 'heart',
  color: '#0077CC',
  is_builtin: 1,
  field_definitions: JSON.stringify([{ key: 'systolic', label: 'Systolic', dataType: 'numeric', required: true }])
};

const customWeight = {
  id: 'weight',
  display_name: 'Weight',
  icon: null,
  color: null,
  is_builtin: 0,
  field_definitions: JSON.stringify([{ key: 'weight_kg', label: 'Weight', dataType: 'numeric', required: true }])
};

function clearSecureStoreFlag() {
  // The mock's backing store is a module-scoped global, not reset by __fakeDb._reset().
  // Reassign (not delete) — the mock module only lazily creates it once at load time.
  (global as any).__EXPO_SECURE_STORE_STORE = {};
}

describe('profileParameterTypes', () => {
  beforeEach(() => {
    __fakeDb._reset();
    __fakeDb._seedParameterTypes([builtinBp, customWeight]);
    clearSecureStoreFlag();
  });

  test('fetchParameterTypesForProfile includes built-ins and only assigned custom types', async () => {
    __fakeDb._seedProfileParameterTypes([{ profile_id: 'profile-a', parameter_type_id: 'weight' }]);

    const forA = await fetchParameterTypesForProfile('profile-a');
    expect(forA.map(t => t.id).sort()).toEqual(['bp', 'weight']);

    const forB = await fetchParameterTypesForProfile('profile-b');
    expect(forB.map(t => t.id)).toEqual(['bp']);
  });

  test('fetchParameterTypesForProfile(null) returns only built-ins', async () => {
    __fakeDb._seedProfileParameterTypes([{ profile_id: 'profile-a', parameter_type_id: 'weight' }]);
    const forNone = await fetchParameterTypesForProfile(null);
    expect(forNone.map(t => t.id)).toEqual(['bp']);
  });

  test('addParameterTypeToProfile and removeParameterTypeFromProfile toggle membership', async () => {
    await addParameterTypeToProfile('profile-a', 'weight');
    expect(await fetchProfileParameterTypeIds('profile-a')).toEqual(new Set(['weight']));

    await removeParameterTypeFromProfile('profile-a', 'weight');
    expect(await fetchProfileParameterTypeIds('profile-a')).toEqual(new Set());
  });

  test('assignParameterTypeToProfiles adds the type to every listed profile', async () => {
    await assignParameterTypeToProfiles('weight', ['profile-a', 'profile-b']);
    expect(await fetchProfileParameterTypeIds('profile-a')).toEqual(new Set(['weight']));
    expect(await fetchProfileParameterTypeIds('profile-b')).toEqual(new Set(['weight']));
  });

  test('backfill assigns every existing custom type to every existing profile, once', async () => {
    __fakeDb._seedProfiles([{ id: 'profile-a' }, { id: 'profile-b' }]);

    await backfillLegacyCustomParameterTypeScoping();

    expect(await fetchProfileParameterTypeIds('profile-a')).toEqual(new Set(['weight']));
    expect(await fetchProfileParameterTypeIds('profile-b')).toEqual(new Set(['weight']));
  });

  test('backfill does not resurrect a type a user explicitly removed on a later run', async () => {
    __fakeDb._seedProfiles([{ id: 'profile-a' }]);

    await backfillLegacyCustomParameterTypeScoping();
    await removeParameterTypeFromProfile('profile-a', 'weight');

    // Simulates a second app launch: the migration flag is already set, so this must
    // be a no-op rather than re-adding what the user just removed.
    await backfillLegacyCustomParameterTypeScoping();

    expect(await fetchProfileParameterTypeIds('profile-a')).toEqual(new Set());
  });
});
