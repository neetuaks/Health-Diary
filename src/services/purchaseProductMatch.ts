import { PurchasesOffering, PurchasesPackageInfo } from './purchases';

// Extracted from PaywallScreen.tsx so it's testable without pulling in React or
// theme components (same reasoning as tierMapping.ts's own extraction) — and so
// the colon-matching behavior below gets a focused, fast unit test instead of
// only being exercised indirectly through full screen rendering.
//
// On Google Play, RevenueCat reports a subscription's product identifier as
// `subscriptionId:basePlanId` (e.g. "pro_monthly:p1m"), not the bare
// `pro_monthly` that PaywallScreen's PRODUCT_ID_MAP uses and that iOS reports
// as-is (CLAUDE-CODE-PROMPT-legal-links.md §8). An exact match would silently
// fail on Android, falling back to hardcoded pricing and a null package.
// Comparing only the part before any colon makes both platforms match.
export function findPackage(offering: PurchasesOffering | null, productId: string): PurchasesPackageInfo | undefined {
  return offering?.availablePackages.find(p => p.product.identifier.split(':')[0] === productId);
}
