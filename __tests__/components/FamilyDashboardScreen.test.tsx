import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import FamilyDashboardScreen from '../../src/screens/FamilyDashboardScreen';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (cb: any) => require('react').useEffect(cb, []),
}));

const mockSetActiveProfile = jest.fn();
jest.mock('../../src/services/profileContext', () => ({ useProfile: jest.fn() }));
jest.mock('../../src/services/entitlement', () => ({ useEntitlement: jest.fn() }));
jest.mock('../../src/services/familyDashboard', () => ({ fetchFamilyDashboardData: jest.fn() }));

const { useProfile } = require('../../src/services/profileContext');
const { useEntitlement } = require('../../src/services/entitlement');
const { fetchFamilyDashboardData } = require('../../src/services/familyDashboard');

const ALICE = { id: 'p1', name: 'Alice' };
const BOB = { id: 'p2', name: 'Bob' };

describe('FamilyDashboardScreen gating (FAMILY-FEATURES-SPEC §1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProfile.mockReturnValue({ profiles: [ALICE, BOB], setActiveProfile: mockSetActiveProfile });
  });

  test('Free/Pro (familyDashboard: false) shows a locked upsell instead of any data, and never fetches dashboard data', async () => {
    useEntitlement.mockReturnValue({ limits: { familyDashboard: false } });

    await render(<FamilyDashboardScreen />);

    expect(await screen.findByText('Family Dashboard')).toBeTruthy();
    expect(screen.getByText('See Plans')).toBeTruthy();
    expect(fetchFamilyDashboardData).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('See Plans'));
    expect(mockNavigate).toHaveBeenCalledWith('Paywall');
  });

  test('Premium shows profile cards from fetchFamilyDashboardData', async () => {
    useEntitlement.mockReturnValue({ limits: { familyDashboard: true } });
    fetchFamilyDashboardData.mockResolvedValue([
      { profile: ALICE, parameters: [], hasAnyReadings: false, needsAttention: false },
      { profile: BOB, parameters: [], hasAnyReadings: false, needsAttention: false },
    ]);

    await render(<FamilyDashboardScreen />);

    expect(await screen.findByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(fetchFamilyDashboardData).toHaveBeenCalledWith([ALICE, BOB]);
  });

  test('locked (over-limit) profiles are excluded from the dashboard fetch', async () => {
    useEntitlement.mockReturnValue({ limits: { familyDashboard: true } });
    fetchFamilyDashboardData.mockResolvedValue([]);
    useProfile.mockReturnValue({ profiles: [ALICE, { ...BOB, locked_at: '2024-01-01T00:00:00.000Z' }], setActiveProfile: mockSetActiveProfile });

    await render(<FamilyDashboardScreen />);

    await waitFor(() => expect(fetchFamilyDashboardData).toHaveBeenCalledWith([ALICE]));
  });

  test('tapping a card sets that profile active and navigates to Diary', async () => {
    useEntitlement.mockReturnValue({ limits: { familyDashboard: true } });
    fetchFamilyDashboardData.mockResolvedValue([
      { profile: ALICE, parameters: [], hasAnyReadings: false, needsAttention: false },
    ]);

    await render(<FamilyDashboardScreen />);
    await fireEvent.press(await screen.findByText('Alice'));

    expect(mockSetActiveProfile).toHaveBeenCalledWith('p1');
    expect(mockNavigate).toHaveBeenCalledWith('MainTabs', { screen: 'Diary' });
  });
});
