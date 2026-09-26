jest.mock('../src/db/init', () => require('../__mocks__/fakeDb'));

import { fetchReadingsMatchingFilter, deleteReadingsMatchingFilter } from '../src/services/readingService';

const { __fakeDb } = require('../__mocks__/fakeDb');

function seed() {
  __fakeDb._seedReadings([
    {
      id: 'r1',
      profile_id: 'p1',
      parameter_type_id: 'bp',
      recorded_at: '2024-03-10T09:00:00.000Z',
      created_at: '2024-03-10T09:00:00.000Z',
      source: 'manual',
      vals: JSON.stringify({ systolic: 120, diastolic: 80 }),
      notes: null
    },
    {
      id: 'r2',
      profile_id: 'p1',
      parameter_type_id: 'glucose',
      recorded_at: '2024-03-15T09:00:00.000Z',
      created_at: '2024-03-15T09:00:00.000Z',
      source: 'manual',
      vals: JSON.stringify({ value: 100 }),
      notes: null
    },
    {
      id: 'r3',
      profile_id: 'p1',
      parameter_type_id: 'bp',
      recorded_at: '2024-04-01T09:00:00.000Z',
      created_at: '2024-04-01T09:00:00.000Z',
      source: 'manual',
      vals: JSON.stringify({ systolic: 118, diastolic: 76 }),
      notes: null
    },
    {
      id: 'r4',
      profile_id: 'p2',
      parameter_type_id: 'bp',
      recorded_at: '2024-03-10T09:00:00.000Z',
      created_at: '2024-03-10T09:00:00.000Z',
      source: 'manual',
      vals: JSON.stringify({ systolic: 130, diastolic: 85 }),
      notes: null
    }
  ]);
}

describe('bulk delete filter', () => {
  beforeEach(() => {
    __fakeDb._reset();
  });

  test('an empty filter returns all of one profile\'s readings and excludes another profile\'s', async () => {
    seed();
    const result = await fetchReadingsMatchingFilter('p1', {});
    expect(result.map(r => r.id).sort()).toEqual(['r1', 'r2', 'r3']);
  });

  test('filters by parameterTypeId', async () => {
    seed();
    const result = await fetchReadingsMatchingFilter('p1', { parameterTypeId: 'bp' });
    expect(result.map(r => r.id).sort()).toEqual(['r1', 'r3']);
  });

  test('from/to date filtering is inclusive at both boundaries', async () => {
    seed();
    const from = new Date('2024-03-10T09:00:00.000Z');
    const to = new Date('2024-03-15T09:00:00.000Z');
    const result = await fetchReadingsMatchingFilter('p1', { from, to });
    expect(result.map(r => r.id).sort()).toEqual(['r1', 'r2']);
  });

  test('excludes readings just outside the from/to boundary', async () => {
    seed();
    const from = new Date('2024-03-10T09:00:00.001Z'); // 1ms after r1
    const to = new Date('2024-03-15T08:59:59.999Z'); // 1ms before r2
    const result = await fetchReadingsMatchingFilter('p1', { from, to });
    expect(result).toEqual([]);
  });

  test('deleteReadingsMatchingFilter deletes only the matches, leaves everything else, and returns the count', async () => {
    seed();
    const deletedCount = await deleteReadingsMatchingFilter('p1', { parameterTypeId: 'bp' });
    expect(deletedCount).toBe(2);

    const remaining = await __fakeDb.getAllAsync('SELECT * FROM readings;');
    expect(remaining.map((r: any) => r.id).sort()).toEqual(['r2', 'r4']);
  });

  test('a filter matching zero readings deletes nothing and returns 0', async () => {
    seed();
    const deletedCount = await deleteReadingsMatchingFilter('p1', { parameterTypeId: 'does-not-exist' });
    expect(deletedCount).toBe(0);

    const remaining = await __fakeDb.getAllAsync('SELECT * FROM readings;');
    expect(remaining.length).toBe(4);
  });
});
