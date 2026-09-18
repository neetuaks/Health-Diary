import { getOnboardingChoice, setOnboardingChoice } from '../src/services/onboarding';

const SecureStore = require('expo-secure-store');

describe('onboarding choice persistence', () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync('onboarding_choice');
  });

  test('returns null when no choice has been recorded yet', async () => {
    expect(await getOnboardingChoice()).toBeNull();
  });

  test('persists and returns the "new" choice', async () => {
    await setOnboardingChoice('new');
    expect(await getOnboardingChoice()).toBe('new');
  });

  test('persists and returns the "existing" choice', async () => {
    await setOnboardingChoice('existing');
    expect(await getOnboardingChoice()).toBe('existing');
  });
});
