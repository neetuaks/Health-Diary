// Thin wrapper around the react-native-purchases (RevenueCat) SDK — every other
// module (entitlement.tsx, PaywallScreen, tests) goes through this file rather
// than importing the SDK directly, per parameterRegistry.ts/backup.ts's
// "src/services/*.ts owns one concern" convention, and so tests can mock this
// one seam instead of the whole native module.
//
// react-native-purchases is a NATIVE module — dev-client only (see CLAUDE.md);
// it does not run under Expo Go, and this app has no dev-client build with it
// linked yet. The require() below is deliberately lazy (inside a function, not
// a top-level import) so that under Expo Go — where the JS package is present
// (needed so Metro can even bundle the app) but the native side isn't linked —
// a failure surfaces only when a Purchases call actually runs, and every
// exported function here catches that and resolves to a safe fallback instead
// of throwing through to the caller. See entitlement.tsx, which fails closed to
// the 'free' tier on any rejection from this module.
export type PurchasesEntitlementInfo = { identifier: string; isActive: boolean };
export type PurchasesCustomerInfo = {
  entitlements: { active: Record<string, PurchasesEntitlementInfo> };
};
export type PurchasesPackageInfo = {
  identifier: string;
  product: { identifier: string; priceString: string; title: string };
};
export type PurchasesOffering = {
  identifier: string;
  availablePackages: PurchasesPackageInfo[];
};

let sdk: any = null;
function getSDK(): any {
  if (sdk) return sdk;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sdk = require('react-native-purchases').default ?? require('react-native-purchases');
    return sdk;
  } catch {
    return null;
  }
}

let configured = false;

export async function configurePurchases(apiKey: string): Promise<void> {
  const Purchases = getSDK();
  if (!Purchases || !apiKey) return;
  try {
    // Anonymous app user ID only — this app has no accounts (see PAYWALL-SPEC §8/§9).
    Purchases.configure({ apiKey });
    configured = true;
  } catch {
    configured = false;
  }
}

export async function getCustomerInfo(): Promise<PurchasesCustomerInfo | null> {
  const Purchases = getSDK();
  if (!Purchases) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

export async function getOfferings(): Promise<PurchasesOffering | null> {
  const Purchases = getSDK();
  if (!Purchases) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings?.current ?? null;
  } catch {
    return null;
  }
}

export async function purchasePackage(pkg: PurchasesPackageInfo): Promise<PurchasesCustomerInfo | null> {
  const Purchases = getSDK();
  if (!Purchases) throw new Error('Purchases are unavailable in this build.');
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(): Promise<PurchasesCustomerInfo | null> {
  const Purchases = getSDK();
  if (!Purchases) return null;
  try {
    return await Purchases.restorePurchases();
  } catch {
    return null;
  }
}

// Returns a no-op unsubscribe when the SDK is unavailable, so callers never
// need to branch on whether listening actually worked.
export function addCustomerInfoUpdateListener(cb: (info: PurchasesCustomerInfo) => void): () => void {
  const Purchases = getSDK();
  if (!Purchases || typeof Purchases.addCustomerInfoUpdateListener !== 'function') return () => {};
  try {
    Purchases.addCustomerInfoUpdateListener(cb);
    return () => {
      try { Purchases.removeCustomerInfoUpdateListener?.(cb); } catch { /* best-effort */ }
    };
  } catch {
    return () => {};
  }
}

export function isConfigured(): boolean {
  return configured;
}
