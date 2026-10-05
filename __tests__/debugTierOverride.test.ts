import { getDebugTierOverride, setDebugTierOverride } from '../src/services/debugTierOverride';

const SecureStore = require('expo-secure-store');

describe('debugTierOverride (dev-only Pro/Premium testing switch)', () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync('debug_tier_override');
  });

  test('defaults to null (no override) when nothing has been set', async () => {
    expect(await getDebugTierOverride()).toBeNull();
  });

  test('setting a tier persists it and getDebugTierOverride reads it back', async () => {
    await setDebugTierOverride('premium');
    expect(await getDebugTierOverride()).toBe('premium');
  });

  test('setting null clears a previously stored override', async () => {
    await setDebugTierOverride('pro');
    await setDebugTierOverride(null);
    expect(await getDebugTierOverride()).toBeNull();
  });
});
