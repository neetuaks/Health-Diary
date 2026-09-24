import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import NewRecordModal from '../../src/components/NewRecordModal';

const BP_TYPE = {
  id: 'bp',
  display_name: 'Blood Pressure',
  icon: '',
  color: '',
  field_definitions: [
    { key: 'systolic', label: 'Systolic', unit: 'mmHg', dataType: 'numeric', required: true, min: 50, max: 260 },
    { key: 'diastolic', label: 'Diastolic', unit: 'mmHg', dataType: 'numeric', required: true, min: 30, max: 160 },
  ],
};

jest.mock('../../src/services/parameterRegistry', () => ({ fetchParameterTypes: jest.fn(async () => [BP_TYPE]) }));
jest.mock('../../src/services/readingService', () => ({
  insertReading: jest.fn(async (r: any) => ({ ...r, id: 'r1', created_at: '2024-01-01T00:00:00.000Z' })),
  updateReading: jest.fn(async () => {}),
}));
jest.mock('../../src/services/profileContext', () => ({
  useProfile: () => ({ activeProfile: { id: 'p1', name: 'Alice', glucose_unit_pref: 'mg/dL' } }),
}));

const { insertReading, updateReading } = require('../../src/services/readingService');

describe('NewRecordModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
  });

  test('rejects save when a required field is missing', async () => {
    const onSaved = jest.fn();
    await render(<NewRecordModal visible onClose={jest.fn()} onSaved={onSaved} />);

    await screen.findByText(/Systolic/);
    await fireEvent.press(screen.getByLabelText('Save'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Missing', 'Systolic is required'));
    expect(insertReading).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  test('shows an out-of-range warning without blocking typing', async () => {
    await render(<NewRecordModal visible onClose={jest.fn()} />);

    await screen.findByText(/Systolic/);
    const inputs = screen.getAllByDisplayValue('');
    await fireEvent.changeText(inputs[0], '300'); // systolic, max 260

    expect(await screen.findByText(/Above the usual range/)).toBeTruthy();
  });

  test('saves a valid manual entry and shows the live BP classification', async () => {
    const onSaved = jest.fn();
    const onClose = jest.fn();
    await render(<NewRecordModal visible onClose={onClose} onSaved={onSaved} />);

    await screen.findByText(/Systolic/);
    const [systolicInput, diastolicInput] = screen.getAllByDisplayValue('');
    await fireEvent.changeText(systolicInput, '118');
    await fireEvent.changeText(diastolicInput, '76');

    expect(await screen.findByText('Normal')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Save'));

    await waitFor(() => expect(insertReading).toHaveBeenCalled());
    const payload = insertReading.mock.calls[0][0];
    expect(payload.profile_id).toBe('p1');
    expect(payload.parameter_type_id).toBe('bp');
    expect(payload.vals).toEqual({ systolic: 118, diastolic: 76 });
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test('editing an existing reading pre-fills values and calls updateReading, not insertReading', async () => {
    const editingReading = {
      id: 'r9',
      profile_id: 'p1',
      parameter_type_id: 'bp',
      recorded_at: '2024-01-01T00:00:00.000Z',
      created_at: '2024-01-01T00:00:00.000Z',
      source: 'manual' as const,
      vals: { systolic: 130, diastolic: 85 },
      notes: null,
    };
    await render(<NewRecordModal visible onClose={jest.fn()} editingReading={editingReading as any} />);

    expect(await screen.findByDisplayValue('130')).toBeTruthy();
    expect(screen.getByDisplayValue('85')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Save'));

    await waitFor(() => expect(updateReading).toHaveBeenCalled());
    expect(insertReading).not.toHaveBeenCalled();
  });
});
