import * as SecureStore from 'expo-secure-store';

const ONBOARDING_CHOICE_KEY = 'onboarding_choice';

// Recorded once, the first time a device with zero profiles is asked "new
// user or existing key" (see FirstRunKeyChoiceModal) — not re-asked after
// that, regardless of what the user does with their data afterward (e.g.
// deleting all data doesn't reset this; it's about device/install history,
// not current data state).
export type OnboardingChoice = 'new' | 'existing';

export async function getOnboardingChoice(): Promise<OnboardingChoice | null> {
  const v = await SecureStore.getItemAsync(ONBOARDING_CHOICE_KEY);
  return v === 'new' || v === 'existing' ? v : null;
}

export async function setOnboardingChoice(choice: OnboardingChoice) {
  await SecureStore.setItemAsync(ONBOARDING_CHOICE_KEY, choice);
}
