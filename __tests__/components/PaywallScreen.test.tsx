import React from 'react';
import { render, screen } from '@testing-library/react-native';
import PaywallScreen from '../../src/screens/PaywallScreen';

jest.mock('../../src/services/entitlement', () => ({
  useEntitlement: () => ({ tier: 'free', refresh: jest.fn() }),
}));
jest.mock('../../src/services/purchases', () => ({
  getOfferings: jest.fn(async () => null),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(async () => null),
}));

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

describe('PaywallScreen legal footer (CLAUDE-CODE-PROMPT-legal-links.md §6)', () => {
  test('title reads "Readiva Plans"', async () => {
    await render(<PaywallScreen navigation={navigation} />);
    expect(await screen.findByText('Readiva Plans')).toBeTruthy();
  });

  test('shows the Terms/Privacy links and the renewal disclosure text', async () => {
    await render(<PaywallScreen navigation={navigation} />);

    expect(await screen.findByText('Terms of Service')).toBeTruthy();
    expect(screen.getByText('Privacy Policy')).toBeTruthy();
    // Only the two links Apple requires here, not Medical Disclaimer too.
    expect(screen.queryByText('Medical Disclaimer')).toBeNull();
    expect(screen.getByText(/Renews automatically until you cancel/)).toBeTruthy();
  });
});
