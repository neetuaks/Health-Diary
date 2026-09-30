jest.mock('../src/db/init', () => require('../__mocks__/fakeDb'));

import { fetchFamilyDashboardData, STALE_READING_DAYS } from '../src/services/familyDashboard';

const { __fakeDb } = require('../__mocks__/fakeDb');

const BP_TYPE = {
  id: 'bp',
  display_name: 'Blood Pressure',
  icon: null,
  color: null,
  is_builtin: 1,
  field_definitions: JSON.stringify([
    { key: 'systolic', label: 'Systolic', dataType: 'numeric', required: true },
    { key: 'diastolic', label: 'Diastolic', dataType: 'numeric', required: true },
  ]),
};

const WEIGHT_TYPE = {
  id: 'weight',
  display_name: 'Weight',
  icon: null,
  color: null,
  is_builtin: 0,
  field_definitions: JSON.stringify([{ key: 'weight_kg', label: 'Weight', dataType: 'numeric', unit: 'kg', required: true }]),
};

function iso(daysAgo: number) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

describe('fetchFamilyDashboardData (FAMILY-FEATURES-SPEC §1)', () => {
  beforeEach(() => {
    __fakeDb._reset();
    __fakeDb._seedParameterTypes([BP_TYPE, WEIGHT_TYPE]);
    __fakeDb._seedProfiles([
      { id: 'p1', name: 'Alice', date_of_birth: '1990-01-01', glucose_unit_pref: 'mg/dL', weight_unit_pref: 'kg', last_backup_at: null, locked_at: null },
      { id: 'p2', name: 'Bob', date_of_birth: '1990-01-01', glucose_unit_pref: 'mg/dL', weight_unit_pref: 'kg', last_backup_at: null, locked_at: null },
    ]);
  });

  test('shows the latest reading per (profile, parameter), not older ones', async () => {
    __fakeDb._seedReadings([
      { id: 'r-old', profile_id: 'p1', parameter_type_id: 'bp', recorded_at: iso(5), created_at: iso(5), source: 'manual', vals: JSON.stringify({ systolic: 110, diastolic: 70 }), notes: null },
      { id: 'r-new', profile_id: 'p1', parameter_type_id: 'bp', recorded_at: iso(1), created_at: iso(1), source: 'manual', vals: JSON.stringify({ systolic: 118, diastolic: 76 }), notes: null },
    ]);

    const [card] = await fetchFamilyDashboardData([{ id: 'p1', name: 'Alice', date_of_birth: '1990-01-01' } as any]);
    const bpCard = card.parameters.find(p => p.parameterType.id === 'bp')!;
    expect(bpCard.latestReading?.id).toBe('r-new');
    expect(bpCard.values.find(v => v.label === 'Systolic')?.display).toBe('118');
  });

  test('flags an out-of-range latest reading as needing attention', async () => {
    __fakeDb._seedReadings([
      { id: 'r1', profile_id: 'p1', parameter_type_id: 'bp', recorded_at: iso(1), created_at: iso(1), source: 'manual', vals: JSON.stringify({ systolic: 190, diastolic: 130 }), notes: null },
    ]);

    const [card] = await fetchFamilyDashboardData([{ id: 'p1', name: 'Alice', date_of_birth: '1990-01-01' } as any]);
    const bpCard = card.parameters.find(p => p.parameterType.id === 'bp')!;
    expect(bpCard.colorKey).toBe('danger');
    expect(bpCard.needsAttention).toBe(true);
    expect(card.needsAttention).toBe(true);
  });

  test('flags a stale reading (older than the staleness window) as needing attention even when in range', async () => {
    __fakeDb._seedReadings([
      { id: 'r1', profile_id: 'p1', parameter_type_id: 'bp', recorded_at: iso(STALE_READING_DAYS + 1), created_at: iso(STALE_READING_DAYS + 1), source: 'manual', vals: JSON.stringify({ systolic: 115, diastolic: 75 }), notes: null },
    ]);

    const [card] = await fetchFamilyDashboardData([{ id: 'p1', name: 'Alice', date_of_birth: '1990-01-01' } as any]);
    const bpCard = card.parameters.find(p => p.parameterType.id === 'bp')!;
    expect(bpCard.colorKey).toBe('success');
    expect(bpCard.isStale).toBe(true);
    expect(bpCard.needsAttention).toBe(true);
  });

  test('a custom parameter with no clinical thresholds still shows its latest value and unit, unflagged when recent', async () => {
    // Custom types only show up for a profile once assigned to it — see
    // CUSTOM-PARAM-ASSIGNMENT-SPEC.md / profileParameterTypes.ts.
    __fakeDb._seedProfileParameterTypes([{ profile_id: 'p1', parameter_type_id: 'weight' }]);
    __fakeDb._seedReadings([
      { id: 'r1', profile_id: 'p1', parameter_type_id: 'weight', recorded_at: iso(1), created_at: iso(1), source: 'manual', vals: JSON.stringify({ weight_kg: 70 }), notes: null },
    ]);

    const [card] = await fetchFamilyDashboardData([{ id: 'p1', name: 'Alice', date_of_birth: '1990-01-01' } as any]);
    const weightCard = card.parameters.find(p => p.parameterType.id === 'weight')!;
    expect(weightCard.values[0].display).toBe('70');
    expect(weightCard.values[0].unit).toBe('kg');
    expect(weightCard.colorKey).toBeNull();
    expect(weightCard.needsAttention).toBe(false);
  });

  test('a profile with zero readings shows hasAnyReadings: false and no needsAttention', async () => {
    const [card] = await fetchFamilyDashboardData([{ id: 'p1', name: 'Alice', date_of_birth: '1990-01-01' } as any]);
    expect(card.hasAnyReadings).toBe(false);
    expect(card.needsAttention).toBe(false);
  });

  test('works across several profiles independently, and with just one', async () => {
    __fakeDb._seedReadings([
      { id: 'r1', profile_id: 'p1', parameter_type_id: 'bp', recorded_at: iso(1), created_at: iso(1), source: 'manual', vals: JSON.stringify({ systolic: 115, diastolic: 75 }), notes: null },
      { id: 'r2', profile_id: 'p2', parameter_type_id: 'bp', recorded_at: iso(1), created_at: iso(1), source: 'manual', vals: JSON.stringify({ systolic: 190, diastolic: 130 }), notes: null },
    ]);

    const cards = await fetchFamilyDashboardData([
      { id: 'p1', name: 'Alice', date_of_birth: '1990-01-01' } as any,
      { id: 'p2', name: 'Bob', date_of_birth: '1990-01-01' } as any,
    ]);
    expect(cards.find(c => c.profile.id === 'p1')!.needsAttention).toBe(false);
    expect(cards.find(c => c.profile.id === 'p2')!.needsAttention).toBe(true);

    const single = await fetchFamilyDashboardData([{ id: 'p1', name: 'Alice', date_of_birth: '1990-01-01' } as any]);
    expect(single).toHaveLength(1);
  });
});
