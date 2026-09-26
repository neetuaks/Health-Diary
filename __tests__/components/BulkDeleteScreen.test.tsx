import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import BulkDeleteScreen from '../../src/screens/BulkDeleteScreen';

const PROFILE_A = { id: 'p1', name: 'Alice', glucose_unit_pref: 'mg/dL' as const };
const PROFILE_B = { id: 'p2', name: 'Bob', glucose_unit_pref: 'mg/dL' as const };

const BP_TYPE = {
  id: 'bp',
  display_name: 'Blood Pressure',
  icon: null,
  color: null,
  is_builtin: 1,
  field_definitions: [
    { key: 'systolic', label: 'Systolic', dataType: 'numeric', required: true },
    { key: 'diastolic', label: 'Diastolic', dataType: 'numeric', required: true }
  ]
};

const GLUCOSE_TYPE = {
  id: 'glucose',
  display_name: 'Glucose',
  icon: null,
  color: null,
  is_builtin: 1,
  field_definitions: [{ key: 'value', label: 'Glucose', dataType: 'numeric', required: true }]
};

function reading(id: string, overrides: any = {}) {
  return {
    id,
    profile_id: 'p1',
    parameter_type_id: 'bp',
    recorded_at: '2024-03-10T09:00:00.000Z',
    created_at: '2024-03-10T09:00:00.000Z',
    source: 'manual',
    vals: { systolic: 120, diastolic: 80 },
    notes: null,
    ...overrides
  };
}

jest.mock('../../src/services/profileContext', () => ({ useProfile: jest.fn() }));
jest.mock('../../src/services/parameterRegistry', () => ({ fetchParameterTypes: jest.fn() }));
jest.mock('../../src/services/readingService', () => ({
  fetchReadingsMatchingFilter: jest.fn(),
  deleteReadingsMatchingFilter: jest.fn()
}));

const { useProfile } = require('../../src/services/profileContext');
const { fetchParameterTypes } = require('../../src/services/parameterRegistry');
const { fetchReadingsMatchingFilter, deleteReadingsMatchingFilter } = require('../../src/services/readingService');

describe('BulkDeleteScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  test('shows a live count scoped to the active profile with the default filter', async () => {
    useProfile.mockReturnValue({ profiles: [PROFILE_A], activeProfile: PROFILE_A });
    fetchParameterTypes.mockResolvedValue([BP_TYPE, GLUCOSE_TYPE]);
    fetchReadingsMatchingFilter.mockResolvedValue([reading('r1'), reading('r2'), reading('r3')]);

    await render(<BulkDeleteScreen />);

    expect(await screen.findByText('3 readings match these filters')).toBeTruthy();
    expect(fetchReadingsMatchingFilter).toHaveBeenCalledWith('p1', { parameterTypeId: null, from: null, to: null });
  });

  test('selecting a parameter type chip re-queries with that type', async () => {
    useProfile.mockReturnValue({ profiles: [PROFILE_A], activeProfile: PROFILE_A });
    fetchParameterTypes.mockResolvedValue([BP_TYPE, GLUCOSE_TYPE]);
    fetchReadingsMatchingFilter.mockResolvedValueOnce([reading('r1'), reading('r2')]).mockResolvedValueOnce([reading('r1')]);

    await render(<BulkDeleteScreen />);
    await screen.findByText('2 readings match these filters');
    await screen.findByText('Blood Pressure');

    await fireEvent.press(screen.getByText('Blood Pressure'));

    await waitFor(() => expect(fetchReadingsMatchingFilter).toHaveBeenLastCalledWith('p1', { parameterTypeId: 'bp', from: null, to: null }));
    expect(await screen.findByText('1 reading matches these filters')).toBeTruthy();
  });

  test('tapping a date preset chip re-queries with a from/to date range', async () => {
    useProfile.mockReturnValue({ profiles: [PROFILE_A], activeProfile: PROFILE_A });
    fetchParameterTypes.mockResolvedValue([BP_TYPE]);
    fetchReadingsMatchingFilter.mockResolvedValue([reading('r1')]);

    await render(<BulkDeleteScreen />);
    await screen.findByText('1 reading matches these filters');

    await fireEvent.press(screen.getByText('This Month'));

    await waitFor(() => {
      const lastCall = fetchReadingsMatchingFilter.mock.calls[fetchReadingsMatchingFilter.mock.calls.length - 1];
      expect(lastCall[0]).toBe('p1');
      expect(lastCall[1].parameterTypeId).toBeNull();
      expect(lastCall[1].from).toBeInstanceOf(Date);
      expect(lastCall[1].to).toBeInstanceOf(Date);
    });
  });

  test('the Preview toggle expands and collapses the matching-readings list', async () => {
    useProfile.mockReturnValue({ profiles: [PROFILE_A], activeProfile: PROFILE_A });
    fetchParameterTypes.mockResolvedValue([BP_TYPE]);
    fetchReadingsMatchingFilter.mockResolvedValue([reading('r1', { vals: { systolic: 120, diastolic: 80 } })]);

    await render(<BulkDeleteScreen />);
    await screen.findByText('1 reading matches these filters');

    expect(screen.queryByText(/Systolic: 120/)).toBeNull();

    await fireEvent.press(screen.getByText('Show preview'));
    expect(await screen.findByText(/Systolic: 120/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Hide preview'));
    expect(screen.queryByText(/Systolic: 120/)).toBeNull();
  });

  test('the Delete button is disabled when 0 readings match', async () => {
    useProfile.mockReturnValue({ profiles: [PROFILE_A], activeProfile: PROFILE_A });
    fetchParameterTypes.mockResolvedValue([BP_TYPE]);
    fetchReadingsMatchingFilter.mockResolvedValue([]);

    await render(<BulkDeleteScreen />);
    await screen.findByText('0 readings match these filters');

    await fireEvent.press(screen.getByText('Delete Matching Readings'));
    expect(deleteReadingsMatchingFilter).not.toHaveBeenCalled();
  });

  test('pressing Delete shows a destructive confirm naming the count; confirming deletes and refreshes to 0', async () => {
    useProfile.mockReturnValue({ profiles: [PROFILE_A], activeProfile: PROFILE_A });
    fetchParameterTypes.mockResolvedValue([BP_TYPE]);
    fetchReadingsMatchingFilter.mockResolvedValueOnce([reading('r1'), reading('r2')]).mockResolvedValueOnce([]);
    deleteReadingsMatchingFilter.mockResolvedValue(2);

    await render(<BulkDeleteScreen />);
    await screen.findByText('2 readings match these filters');

    await fireEvent.press(screen.getByText('Delete Matching Readings'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Delete readings', expect.stringContaining('2'), expect.any(Array)));

    const call = (Alert.alert as jest.Mock).mock.calls.find((c: any[]) => c[0] === 'Delete readings')!;
    const confirmButton = call[2].find((b: any) => b.text === 'Delete');
    await confirmButton.onPress();

    await waitFor(() =>
      expect(deleteReadingsMatchingFilter).toHaveBeenCalledWith('p1', { parameterTypeId: null, from: null, to: null })
    );
    expect(await screen.findByText('0 readings match these filters')).toBeTruthy();
  });

  test('switching the profile picker recomputes the count against the newly selected profile', async () => {
    useProfile.mockReturnValue({ profiles: [PROFILE_A, PROFILE_B], activeProfile: PROFILE_A });
    fetchParameterTypes.mockResolvedValue([BP_TYPE]);
    fetchReadingsMatchingFilter
      .mockResolvedValueOnce([reading('r1')])
      .mockResolvedValueOnce([reading('r2', { profile_id: 'p2' }), reading('r3', { profile_id: 'p2' })]);

    await render(<BulkDeleteScreen />);
    await screen.findByText('1 reading matches these filters');

    await fireEvent.press(screen.getByText('Bob'));

    await waitFor(() => expect(fetchReadingsMatchingFilter).toHaveBeenLastCalledWith('p2', { parameterTypeId: null, from: null, to: null }));
    expect(await screen.findByText('2 readings match these filters')).toBeTruthy();
  });
});
