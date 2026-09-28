import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { LIMITS, Tier, TierLimits } from './limits';
import { tierFromCustomerInfo } from './tierMapping';
import {
  configurePurchases,
  getCustomerInfo,
  addCustomerInfoUpdateListener,
  PurchasesCustomerInfo,
} from './purchases';

export { tierFromCustomerInfo } from './tierMapping';

type EntitlementContextType = {
  tier: Tier;
  limits: TierLimits;
  isPro: boolean;
  isPremium: boolean;
  loading: boolean;
  customerInfo: PurchasesCustomerInfo | null;
  refresh: () => Promise<void>;
};

const EntitlementContext = createContext<EntitlementContextType>({
  tier: 'free',
  limits: LIMITS.free,
  isPro: false,
  isPremium: false,
  loading: true,
  customerInfo: null,
  refresh: async () => {},
});

function readApiKey(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as any;
  const key = extra.revenueCatApiKey ?? {};
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Platform = require('react-native').Platform;
  return (Platform.OS === 'ios' ? key.ios : key.android) ?? '';
}

// Wraps the app above navigation (see App.tsx). Fails closed to 'free' on any
// error, timeout-free offline state, or missing SDK — per PAYWALL-SPEC §3, this
// must never block the app from opening or block logging, so every await here
// is inside try/catch with a 'free' fallback, and loading only gates the very
// first paint of gated UI, never the app shell itself.
export default function EntitlementProvider({ children }: { children: React.ReactNode }) {
  const [customerInfo, setCustomerInfo] = useState<PurchasesCustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef<() => void>(() => {});

  const refresh = async () => {
    try {
      const info = await getCustomerInfo();
      setCustomerInfo(info);
    } catch {
      setCustomerInfo(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await configurePurchases(readApiKey());
        const info = await getCustomerInfo();
        if (!cancelled) setCustomerInfo(info);
      } catch {
        if (!cancelled) setCustomerInfo(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    unsubRef.current = addCustomerInfoUpdateListener(info => setCustomerInfo(info));
    return () => {
      cancelled = true;
      unsubRef.current();
    };
  }, []);

  const tier = tierFromCustomerInfo(customerInfo);
  const limits = LIMITS[tier];

  return (
    <EntitlementContext.Provider
      value={{ tier, limits, isPro: tier === 'pro', isPremium: tier === 'premium', loading, customerInfo, refresh }}
    >
      {children}
    </EntitlementContext.Provider>
  );
}

export function useEntitlement() {
  return useContext(EntitlementContext);
}
