jest.mock('../src/db/init', () => require('../__mocks__/fakeDb'));

import { insertReading, updateReading, deleteReading, fetchReadingsForProfile } from '../src/services/readingService';

const { __fakeDb } = require('../__mocks__/fakeDb');

describe('readingService vals round-trip (guards against the values/vals mismatch)', () => {
  beforeEach(() => {
    __fakeDb._reset();
  });

  test('insertReading persists vals and returns them on the created reading', async () => {
    const reading = await insertReading({
      profile_id: 'p1',
      parameter_type_id: 'bp',
      recorded_at: '2024-01-01T00:00:00.000Z',
      source: 'manual',
      vals: { systolic: 120, diastolic: 80 }
    } as any);

    expect(reading.vals).toEqual({ systolic: 120, diastolic: 80 });

    const fetched = await fetchReadingsForProfile('p1');
    expect(fetched).toHaveLength(1);
    expect(fetched[0].vals).toEqual({ systolic: 120, diastolic: 80 });
  });

  test('updateReading persists new vals', async () => {
    const reading = await insertReading({
      profile_id: 'p1',
      parameter_type_id: 'bp',
      recorded_at: '2024-01-01T00:00:00.000Z',
      source: 'manual',
      vals: { systolic: 120, diastolic: 80 }
    } as any);

    await updateReading({ ...reading, vals: { systolic: 130, diastolic: 85 } });

    const fetched = await fetchReadingsForProfile('p1');
    expect(fetched[0].vals).toEqual({ systolic: 130, diastolic: 85 });
  });

  test('deleteReading removes only the targeted reading', async () => {
    const a = await insertReading({
      profile_id: 'p1', parameter_type_id: 'bp', recorded_at: '2024-01-01T00:00:00.000Z', source: 'manual', vals: { systolic: 120, diastolic: 80 }
    } as any);
    await insertReading({
      profile_id: 'p1', parameter_type_id: 'glucose', recorded_at: '2024-01-02T00:00:00.000Z', source: 'manual', vals: { value: 100 }
    } as any);

    await deleteReading(a.id);

    const fetched = await fetchReadingsForProfile('p1');
    expect(fetched).toHaveLength(1);
    expect(fetched[0].parameter_type_id).toBe('glucose');
  });
});
