import { Tier } from './limits';
import { PurchasesCustomerInfo } from './purchases';

// Maps RevenueCat's customerInfo -> our own Tier, per PAYWALL-SPEC §3: a
// 'premium' entitlement wins over 'pro', else free. No caller anywhere else
// reads RevenueCat entitlement identifiers directly — this is the one place
// that knows the mapping. Kept in its own plain .ts module (not entitlement.tsx,
// which is a React provider) so it's testable in the node-env jest config
// without needing React/expo-constants pulled in.
export function tierFromCustomerInfo(info: PurchasesCustomerInfo | null | undefined): Tier {
  const active = info?.entitlements?.active ?? {};
  if (active['premium']?.isActive) return 'premium';
  if (active['pro']?.isActive) return 'pro';
  return 'free';
}
