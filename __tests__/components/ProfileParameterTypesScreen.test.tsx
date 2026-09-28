import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ProfileParameterTypesScreen from '../../src/screens/ProfileParameterTypesScreen';

const BP_TYPE = {
  id: 'bp',
  display_name: 'Blood Pressure',
  icon: null,
  color: null,
  is_builtin: 1,
  field_definitions: [{ key: 'systolic', label: 'Systolic', dataType: 'numeric', required: true }]
};

const WEIGHT_TYPE = {
  id: 'weight',
  display_name: 'Weight',
  icon: null,
  color: null,
  is_builtin: 0,
  field_definitions: [{ key: 'weight_kg', label: 'Weight', dataType: 'numeric', unit: 'kg', required: true }]
};

const MOOD_TYPE = {
  id: 'mood',
  display_name: 'Mood',
  icon: null,
  color: null,
  is_builtin: 0,
  field_definitions: [{ key: 'mood', label: 'Mood', dataType: 'text', required: true }]
};

jest.mock('../../src/services/parameterRegistry', () => ({ fetchParameterTypes: jest.fn() }));
jest.mock('../../src/services/profileParameterTypes', () => ({
  fetchProfileParameterTypeIds: jest.fn(),
  addParameterTypeToProfile: jest.fn(),
  removeParameterTypeFromProfile: jest.fn()
}));

const { fetchParameterTypes } = require('../../src/services/parameterRegistry');
const {
  fetchProfileParameterTypeIds,
  addParameterTypeToProfile,
  removeParameterTypeFromProfile
} = require('../../src/services/profileParameterTypes');

const route = { params: { profileId: 'p1', profileName: 'Alice' } };

describe('ProfileParameterTypesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows built-ins as always included and custom types with their current membership', async () => {
    fetchParameterTypes.mockResolvedValue([BP_TYPE, WEIGHT_TYPE, MOOD_TYPE]);
    fetchProfileParameterTypeIds.mockResolvedValue(new Set(['weight']));

    await render(<ProfileParameterTypesScreen route={route} />);

    expect(await screen.findByText('Parameters for Alice')).toBeTruthy();
    expect(screen.getByText('Blood Pressure')).toBeTruthy();
    expect(screen.getAllByText('Built-in').length).toBe(1);

    expect(screen.getByText('Weight')).toBeTruthy();
    expect(screen.getByText('Added to this profile')).toBeTruthy();
    expect(screen.getByText('Mood')).toBeTruthy();
    expect(screen.getByText('Not added to this profile')).toBeTruthy();
  });

  test('pressing Add on a not-yet-added type calls addParameterTypeToProfile and flips to Remove', async () => {
    fetchParameterTypes.mockResolvedValue([BP_TYPE, MOOD_TYPE]);
    fetchProfileParameterTypeIds.mockResolvedValue(new Set());

    await render(<ProfileParameterTypesScreen route={route} />);
    await screen.findByText('Mood');

    await fireEvent.press(screen.getByText('Add'));

    await waitFor(() => expect(addParameterTypeToProfile).toHaveBeenCalledWith('p1', 'mood'));
    expect(await screen.findByText('Remove')).toBeTruthy();
    expect(await screen.findByText('Added to this profile')).toBeTruthy();
  });

  test('pressing Remove on an added type calls removeParameterTypeFromProfile and flips back to Add', async () => {
    fetchParameterTypes.mockResolvedValue([BP_TYPE, WEIGHT_TYPE]);
    fetchProfileParameterTypeIds.mockResolvedValue(new Set(['weight']));

    await render(<ProfileParameterTypesScreen route={route} />);
    await screen.findByText('Weight');

    await fireEvent.press(screen.getByText('Remove'));

    await waitFor(() => expect(removeParameterTypeFromProfile).toHaveBeenCalledWith('p1', 'weight'));
    expect(await screen.findByText('Add')).toBeTruthy();
    expect(await screen.findByText('Not added to this profile')).toBeTruthy();
  });

  test('shows an empty state when there are no custom parameter types', async () => {
    fetchParameterTypes.mockResolvedValue([BP_TYPE]);
    fetchProfileParameterTypeIds.mockResolvedValue(new Set());

    await render(<ProfileParameterTypesScreen route={route} />);

    expect(await screen.findByText('No custom parameter types yet')).toBeTruthy();
  });
});
