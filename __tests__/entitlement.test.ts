import { tierFromCustomerInfo } from '../src/services/tierMapping';

// tierFromCustomerInfo is the one place PAYWALL-SPEC §3 says maps RevenueCat's
// customerInfo -> our Tier; EntitlementProvider itself is a React component
// (tested via a component-suite render, not this node-env config — see
// __tests__/components/), so this file covers the mapping logic directly,
// including the "fails closed to free" cases the spec calls out explicitly.
describe('tierFromCustomerInfo', () => {
  test('a premium entitlement wins over pro', () => {
    const info = { entitlements: { active: { premium: { identifier: 'premium', isActive: true }, pro: { identifier: 'pro', isActive: true } } } };
    expect(tierFromCustomerInfo(info)).toBe('premium');
  });

  test('a pro entitlement resolves to pro when premium is absent', () => {
    const info = { entitlements: { active: { pro: { identifier: 'pro', isActive: true } } } };
    expect(tierFromCustomerInfo(info)).toBe('pro');
  });

  test('no active entitlements resolves to free', () => {
    const info = { entitlements: { active: {} } };
    expect(tierFromCustomerInfo(info)).toBe('free');
  });

  test('null/undefined customerInfo (offline, no cache, or SDK unavailable) fails closed to free', () => {
    expect(tierFromCustomerInfo(null)).toBe('free');
    expect(tierFromCustomerInfo(undefined)).toBe('free');
  });
});
