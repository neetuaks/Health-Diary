import * as SecureStore from 'expo-secure-store';
import { Tier } from './limits';

// Dev-only escape hatch for testing Pro/Premium gates before real RevenueCat
// products exist (see PAYWALL-SPEC.md §8 — that setup needs the user's own
// store/RevenueCat accounts, a separate task from this app's code). Lets a
// developer force the app into any tier locally, bypassing the SDK entirely.
// Every call site gates this behind __DEV__ (false in a release build), so
// it can never surface in anything shipped.
const DEBUG_TIER_OVERRIDE_KEY = 'debug_tier_override';

export async function getDebugTierOverride(): Promise<Tier | null> {
  if (!__DEV__) return null;
  try {
    const v = await SecureStore.getItemAsync(DEBUG_TIER_OVERRIDE_KEY);
    return v === 'free' || v === 'pro' || v === 'premium' ? v : null;
  } catch {
    return null;
  }
}

export async function setDebugTierOverride(tier: Tier | null): Promise<void> {
  if (!__DEV__) return;
  if (tier === null) await SecureStore.deleteItemAsync(DEBUG_TIER_OVERRIDE_KEY);
  else await SecureStore.setItemAsync(DEBUG_TIER_OVERRIDE_KEY, tier);
}
