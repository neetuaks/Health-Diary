import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ParameterTypesScreen from '../../src/screens/ParameterTypesScreen';

// ParameterTypesScreen now reads useNavigation() directly (to deep-link the
// paywall gate) rather than taking a navigation prop — this component is
// rendered bare here (no NavigationContainer ancestor), so the real hook
// would throw "Couldn't find a navigation object" without this mock.
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));

const BP_TYPE = {
  id: 'bp',
  display_name: 'Blood Pressure',
  icon: null,
  color: null,
  is_builtin: 1,
  field_definitions: [
    { key: 'systolic', label: 'Systolic', dataType: 'numeric', unit: 'mmHg', required: true },
    { key: 'diastolic', label: 'Diastolic', dataType: 'numeric', unit: 'mmHg', required: true }
  ]
};

const GLUCOSE_TYPE = {
  id: 'glucose',
  display_name: 'Glucose',
  icon: null,
  color: null,
  is_builtin: 1,
  field_definitions: [{ key: 'value', label: 'Glucose', dataType: 'numeric', unit: 'mg/dL', required: true }]
};

// Field label deliberately different from the type's display_name so
// getByDisplayValue/getByText queries in the edit test aren't ambiguous.
const CUSTOM_TYPE = {
  id: 'custom-1',
  display_name: 'Weight',
  icon: null,
  color: null,
  is_builtin: 0,
  field_definitions: [{ key: 'weight_kg', label: 'Body Weight', dataType: 'numeric', unit: 'kg', required: true }]
};

jest.mock('../../src/services/parameterRegistry', () => ({
  fetchParameterTypes: jest.fn(),
  insertParameterType: jest.fn(),
  updateParameterType: jest.fn(),
  deleteParameterType: jest.fn(),
  countReadingsForParameterType: jest.fn()
}));

// Premium's limits by default (effectively unlimited for this file's purposes)
// so every pre-existing CRUD-flow test below keeps exercising the Add/Edit/
// Delete flow itself, undisturbed by the paywall gate — PAYWALL-SPEC §4.2's
// gate has its own dedicated describe block further down, which overrides
// this per test.
jest.mock('../../src/services/entitlement', () => ({
  useEntitlement: jest.fn(() => ({ limits: { maxCustomParams: 8 } })),
}));
jest.mock('../../src/services/entitlementLocks', () => ({
  reconcileAndPersistParameterTypeLocks: jest.fn(async () => ({ toLock: [], toUnlock: [] })),
}));

jest.mock('../../src/services/profileContext', () => ({
  useProfile: jest.fn()
}));

jest.mock('../../src/services/profileParameterTypes', () => ({
  assignParameterTypeToProfiles: jest.fn()
}));

const {
  fetchParameterTypes,
  insertParameterType,
  updateParameterType,
  deleteParameterType,
  countReadingsForParameterType
} = require('../../src/services/parameterRegistry');
const { useEntitlement } = require('../../src/services/entitlement');
const { useProfile } = require('../../src/services/profileContext');
const { assignParameterTypeToProfiles } = require('../../src/services/profileParameterTypes');

describe('ParameterTypesScreen', () => {
  beforeEach(() => {
    // clearAllMocks (not resetAllMocks) — resetAllMocks would also strip the
    // implementations jest-expo's own setup wires up for native modules, breaking
    // render()/`screen` on every test after the first in this file.
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useEntitlement.mockReturnValue({ limits: { maxCustomParams: 8 } });
    // No profiles by default — matches every pre-existing test in this file, which
    // predates per-profile scoping and asserts nothing about the "Available to"
    // section. It only renders once there's at least one profile (see below).
    useProfile.mockReturnValue({ profiles: [] });
  });

  test('renders built-in types with a Built-in tag and no Edit/Delete buttons', async () => {
    fetchParameterTypes.mockResolvedValue([BP_TYPE, GLUCOSE_TYPE]);
    await render(<ParameterTypesScreen />);

    expect(await screen.findByText('Blood Pressure')).toBeTruthy();
    expect(screen.getAllByText(/Built-in/).length).toBe(2);
    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  test('adding a parameter type with one numeric field calls insertParameterType and refreshes the list', async () => {
    fetchParameterTypes.mockResolvedValueOnce([BP_TYPE]).mockResolvedValueOnce([BP_TYPE, CUSTOM_TYPE]);
    insertParameterType.mockResolvedValue(CUSTOM_TYPE);
    await render(<ParameterTypesScreen />);

    await screen.findByText('Blood Pressure');
    await fireEvent.press(screen.getByText('Add Parameter Type'));

    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Weight'), 'Weight');
    await fireEvent.changeText(screen.getByPlaceholderText('Label (e.g. Weight)'), 'Weight');
    await fireEvent.changeText(screen.getByPlaceholderText('Unit (optional, e.g. kg)'), 'kg');

    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(insertParameterType).toHaveBeenCalled());
    const payload = insertParameterType.mock.calls[0][0];
    expect(payload.display_name).toBe('Weight');
    expect(payload.field_definitions).toEqual([{ key: 'weight', label: 'Weight', dataType: 'numeric', required: true, unit: 'kg' }]);

    expect(await screen.findByText('Weight')).toBeTruthy();
  });

  test('rejects save when display name is empty', async () => {
    fetchParameterTypes.mockResolvedValue([BP_TYPE]);
    await render(<ParameterTypesScreen />);
    await screen.findByText('Blood Pressure');

    await fireEvent.press(screen.getByText('Add Parameter Type'));
    await fireEvent.changeText(screen.getByPlaceholderText('Label (e.g. Weight)'), 'Weight');
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Name required', 'Please enter a display name.'));
    expect(insertParameterType).not.toHaveBeenCalled();
  });

  test('rejects save when display name duplicates an existing type case-insensitively', async () => {
    fetchParameterTypes.mockResolvedValue([BP_TYPE]);
    await render(<ParameterTypesScreen />);
    await screen.findByText('Blood Pressure');

    await fireEvent.press(screen.getByText('Add Parameter Type'));
    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Weight'), 'blood pressure');
    await fireEvent.changeText(screen.getByPlaceholderText('Label (e.g. Weight)'), 'Something');
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Name already used', 'Choose a different display name.'));
    expect(insertParameterType).not.toHaveBeenCalled();
  });

  test('rejects save when a Choice List field has fewer than 2 options', async () => {
    fetchParameterTypes.mockResolvedValue([BP_TYPE]);
    await render(<ParameterTypesScreen />);
    await screen.findByText('Blood Pressure');

    await fireEvent.press(screen.getByText('Add Parameter Type'));
    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Weight'), 'Mood');
    await fireEvent.changeText(screen.getByPlaceholderText('Label (e.g. Weight)'), 'Mood');
    await fireEvent.press(screen.getByText('Choice List'));
    await fireEvent.changeText(screen.getByPlaceholderText('Choices, comma-separated (e.g. Fasting, After Meal)'), 'Happy');
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Choice list needs options', '"Mood" needs at least 2 choices.'));
    expect(insertParameterType).not.toHaveBeenCalled();
  });

  test("rejects save when a numeric field's min is greater than its max", async () => {
    fetchParameterTypes.mockResolvedValue([BP_TYPE]);
    await render(<ParameterTypesScreen />);
    await screen.findByText('Blood Pressure');

    await fireEvent.press(screen.getByText('Add Parameter Type'));
    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Weight'), 'Weight');
    await fireEvent.changeText(screen.getByPlaceholderText('Label (e.g. Weight)'), 'Weight');
    await fireEvent.changeText(screen.getByPlaceholderText('Min (optional)'), '100');
    await fireEvent.changeText(screen.getByPlaceholderText('Max (optional)'), '50');
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Invalid range', '"Weight"\'s minimum must be less than its maximum.')
    );
    expect(insertParameterType).not.toHaveBeenCalled();
  });

  test('editing a custom type and changing a field label preserves its original key', async () => {
    fetchParameterTypes.mockResolvedValue([BP_TYPE, CUSTOM_TYPE]);
    await render(<ParameterTypesScreen />);
    await screen.findByText('Weight');

    await fireEvent.press(screen.getByText('Edit'));
    const labelInput = await screen.findByDisplayValue('Body Weight');
    await fireEvent.changeText(labelInput, 'My Weight');
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(updateParameterType).toHaveBeenCalled());
    const payload = updateParameterType.mock.calls[0][0];
    expect(payload.id).toBe('custom-1');
    expect(payload.field_definitions).toEqual([{ key: 'weight_kg', label: 'My Weight', dataType: 'numeric', unit: 'kg', required: true }]);
  });

  test('deleting a custom type with 0 readings confirms then calls deleteParameterType', async () => {
    fetchParameterTypes.mockResolvedValue([BP_TYPE, CUSTOM_TYPE]);
    countReadingsForParameterType.mockResolvedValue(0);
    await render(<ParameterTypesScreen />);
    await screen.findByText('Weight');

    await fireEvent.press(screen.getByText('Delete'));

    await waitFor(() => expect(countReadingsForParameterType).toHaveBeenCalledWith('custom-1'));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Delete parameter type', 'Delete "Weight"? This cannot be undone.', expect.any(Array))
    );

    const call = (Alert.alert as jest.Mock).mock.calls.find((c: any[]) => c[0] === 'Delete parameter type')!;
    const confirmButton = call[2].find((b: any) => b.text === 'Delete');
    await confirmButton.onPress();

    expect(deleteParameterType).toHaveBeenCalledWith('custom-1');
  });

  test('deleting a custom type with existing readings shows a blocking alert and does not delete', async () => {
    fetchParameterTypes.mockResolvedValue([BP_TYPE, CUSTOM_TYPE]);
    countReadingsForParameterType.mockResolvedValue(3);
    await render(<ParameterTypesScreen />);
    await screen.findByText('Weight');

    await fireEvent.press(screen.getByText('Delete'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Can't delete", '3 readings use "Weight". Delete them first, then try again.')
    );
    expect(deleteParameterType).not.toHaveBeenCalled();
  });

  describe('profile scope on creation', () => {
    beforeEach(() => {
      useProfile.mockReturnValue({ profiles: [{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }] });
    });

    test('defaults to "All Profiles" and assigns the new type to every profile', async () => {
      fetchParameterTypes.mockResolvedValueOnce([BP_TYPE]).mockResolvedValueOnce([BP_TYPE, CUSTOM_TYPE]);
      insertParameterType.mockResolvedValue(CUSTOM_TYPE);
      await render(<ParameterTypesScreen />);
      await screen.findByText('Blood Pressure');

      await fireEvent.press(screen.getByText('Add Parameter Type'));
      await fireEvent.changeText(screen.getByPlaceholderText('e.g. Weight'), 'Weight');
      await fireEvent.changeText(screen.getByPlaceholderText('Label (e.g. Weight)'), 'Weight');
      expect(screen.getByText('All Profiles')).toBeTruthy();
      // "Selected Profiles" not chosen — no per-profile chips should render.
      expect(screen.queryByText('Alice')).toBeNull();

      await fireEvent.press(screen.getByText('Save'));

      await waitFor(() => expect(assignParameterTypeToProfiles).toHaveBeenCalledWith(CUSTOM_TYPE.id, ['p1', 'p2']));
    });

    test('"Selected Profiles" assigns only the chosen profiles', async () => {
      fetchParameterTypes.mockResolvedValueOnce([BP_TYPE]).mockResolvedValueOnce([BP_TYPE, CUSTOM_TYPE]);
      insertParameterType.mockResolvedValue(CUSTOM_TYPE);
      await render(<ParameterTypesScreen />);
      await screen.findByText('Blood Pressure');

      await fireEvent.press(screen.getByText('Add Parameter Type'));
      await fireEvent.changeText(screen.getByPlaceholderText('e.g. Weight'), 'Weight');
      await fireEvent.changeText(screen.getByPlaceholderText('Label (e.g. Weight)'), 'Weight');
      await fireEvent.press(screen.getByText('Selected Profiles'));
      await fireEvent.press(screen.getByText('Alice'));
      await fireEvent.press(screen.getByText('Save'));

      await waitFor(() => expect(assignParameterTypeToProfiles).toHaveBeenCalledWith(CUSTOM_TYPE.id, ['p1']));
    });

    test('rejects save when "Selected Profiles" has none chosen', async () => {
      fetchParameterTypes.mockResolvedValue([BP_TYPE]);
      await render(<ParameterTypesScreen />);
      await screen.findByText('Blood Pressure');

      await fireEvent.press(screen.getByText('Add Parameter Type'));
      await fireEvent.changeText(screen.getByPlaceholderText('e.g. Weight'), 'Weight');
      await fireEvent.changeText(screen.getByPlaceholderText('Label (e.g. Weight)'), 'Weight');
      await fireEvent.press(screen.getByText('Selected Profiles'));
      await fireEvent.press(screen.getByText('Save'));

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith('Select at least one profile', 'Choose which profiles get this parameter type, or switch to "All Profiles".')
      );
      expect(insertParameterType).not.toHaveBeenCalled();
    });

    test('editing an existing custom type does not show the "Available to" section', async () => {
      fetchParameterTypes.mockResolvedValue([BP_TYPE, CUSTOM_TYPE]);
      await render(<ParameterTypesScreen />);
      await screen.findByText('Weight');

      await fireEvent.press(screen.getByText('Edit'));
      await screen.findByDisplayValue('Body Weight');

      expect(screen.queryByText('All Profiles')).toBeNull();
      expect(screen.queryByText('Selected Profiles')).toBeNull();
    });
  });
});

describe('ParameterTypesScreen custom-param limit gate (PAYWALL-SPEC §4.2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  test('at the limit: "Add Parameter Type" shows an upgrade prompt instead of opening the form', async () => {
    useEntitlement.mockReturnValue({ limits: { maxCustomParams: 1 } });
    fetchParameterTypes.mockResolvedValue([BP_TYPE, CUSTOM_TYPE]);
    await render(<ParameterTypesScreen />);
    await screen.findByText('Weight');

    await fireEvent.press(screen.getByText('Add Parameter Type'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(
      'Upgrade to unlock this',
      "Your plan covers 1 custom parameter type. Upgrade to add another.",
      expect.any(Array)
    ));
    expect(screen.queryByPlaceholderText('e.g. Weight')).toBeNull();
  });

  test('under the limit: "Add Parameter Type" opens the form as normal', async () => {
    useEntitlement.mockReturnValue({ limits: { maxCustomParams: 4 } });
    fetchParameterTypes.mockResolvedValue([BP_TYPE, CUSTOM_TYPE]);
    await render(<ParameterTypesScreen />);
    await screen.findByText('Weight');

    await fireEvent.press(screen.getByText('Add Parameter Type'));

    expect(await screen.findByPlaceholderText('e.g. Weight')).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  test('a locked custom type shows a Locked badge instead of Edit/Delete', async () => {
    useEntitlement.mockReturnValue({ limits: { maxCustomParams: 1 } });
    fetchParameterTypes.mockResolvedValue([BP_TYPE, { ...CUSTOM_TYPE, locked_at: '2024-01-01T00:00:00.000Z' }]);
    await render(<ParameterTypesScreen />);

    expect(await screen.findByText(/Weight.*Locked/)).toBeTruthy();
    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
  });
});
