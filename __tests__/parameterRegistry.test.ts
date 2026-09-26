jest.mock('../src/db/init', () => require('../__mocks__/fakeDb'));

import {
  fetchParameterTypes,
  insertParameterType,
  updateParameterType,
  deleteParameterType,
  countReadingsForParameterType
} from '../src/services/parameterRegistry';

const { __fakeDb } = require('../__mocks__/fakeDb');

const builtinBp = {
  id: 'bp',
  display_name: 'Blood Pressure',
  icon: 'heart',
  color: '#0077CC',
  is_builtin: 1,
  field_definitions: JSON.stringify([{ key: 'systolic', label: 'Systolic', dataType: 'numeric', required: true }])
};

describe('parameterRegistry CRUD for custom parameter types', () => {
  beforeEach(() => {
    __fakeDb._reset();
    __fakeDb._seedParameterTypes([builtinBp]);
  });

  test('insertParameterType assigns a UUID id and forces is_builtin = 0', async () => {
    const created = await insertParameterType({
      display_name: 'Weight',
      field_definitions: [{ key: 'weight_kg', label: 'Weight', dataType: 'numeric', unit: 'kg', required: true }]
    });

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(created.is_builtin).toBe(0);

    const all = await fetchParameterTypes();
    expect(all.map(t => t.id)).toContain(created.id);
    const fetched = all.find(t => t.id === created.id)!;
    expect(fetched.display_name).toBe('Weight');
    expect(fetched.field_definitions).toEqual(created.field_definitions);
  });

  test('updateParameterType changes display_name and field_definitions on a custom type', async () => {
    const created = await insertParameterType({
      display_name: 'Weight',
      field_definitions: [{ key: 'weight_kg', label: 'Weight', dataType: 'numeric', required: true }]
    });

    await updateParameterType({
      ...created,
      display_name: 'Body Weight',
      field_definitions: [{ key: 'weight_kg', label: 'Body Weight', dataType: 'numeric', required: true }]
    });

    const fetched = (await fetchParameterTypes()).find(t => t.id === created.id)!;
    expect(fetched.display_name).toBe('Body Weight');
    expect(fetched.field_definitions[0].label).toBe('Body Weight');
  });

  test('updateParameterType is a no-op against a built-in type', async () => {
    await updateParameterType({
      id: 'bp',
      display_name: 'Hacked Name',
      is_builtin: 1,
      field_definitions: []
    } as any);

    const fetched = (await fetchParameterTypes()).find(t => t.id === 'bp')!;
    expect(fetched.display_name).toBe('Blood Pressure');
    expect(fetched.field_definitions).toEqual(JSON.parse(builtinBp.field_definitions));
  });

  test('deleteParameterType removes a custom type with no readings', async () => {
    const created = await insertParameterType({
      display_name: 'Weight',
      field_definitions: [{ key: 'weight_kg', label: 'Weight', dataType: 'numeric', required: true }]
    });

    await deleteParameterType(created.id);

    const all = await fetchParameterTypes();
    expect(all.map(t => t.id)).not.toContain(created.id);
  });

  test('deleteParameterType leaves a built-in type in place', async () => {
    await deleteParameterType('bp');
    const all = await fetchParameterTypes();
    expect(all.map(t => t.id)).toContain('bp');
  });

  test('countReadingsForParameterType returns 0 for an unused type and the correct global count otherwise', async () => {
    const created = await insertParameterType({
      display_name: 'Weight',
      field_definitions: [{ key: 'weight_kg', label: 'Weight', dataType: 'numeric', required: true }]
    });

    expect(await countReadingsForParameterType(created.id)).toBe(0);

    __fakeDb._seedReadings([
      { id: 'r1', profile_id: 'profile-a', parameter_type_id: created.id, recorded_at: '2024-01-01T00:00:00.000Z', created_at: '2024-01-01T00:00:00.000Z', source: 'manual', vals: JSON.stringify({ weight_kg: 70 }), notes: null },
      { id: 'r2', profile_id: 'profile-b', parameter_type_id: created.id, recorded_at: '2024-01-02T00:00:00.000Z', created_at: '2024-01-02T00:00:00.000Z', source: 'manual', vals: JSON.stringify({ weight_kg: 71 }), notes: null },
      { id: 'r3', profile_id: 'profile-a', parameter_type_id: 'bp', recorded_at: '2024-01-03T00:00:00.000Z', created_at: '2024-01-03T00:00:00.000Z', source: 'manual', vals: JSON.stringify({ systolic: 120 }), notes: null }
    ]);

    // Global count across both profile-a and profile-b, not scoped to one profile.
    expect(await countReadingsForParameterType(created.id)).toBe(2);
    expect(await countReadingsForParameterType('bp')).toBe(1);
  });
});
