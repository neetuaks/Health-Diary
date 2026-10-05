// Pure config, no SDK imports — the single source of truth for what each tier
// gets. Every gate in the app reads a TierLimits value (via useEntitlement()),
// never a hard-coded number at the call site. See docs/PAYWALL-SPEC.md §2-3.
export type Tier = 'free' | 'pro' | 'premium';

export interface TierLimits {
  maxProfiles: number;
  maxCustomParams: number;          // built-ins (BP, Glucose) are NOT counted
  historyWindowDays: number | null; // in-app view cap; null = full history
  exportWindowDays: number | null;  // CSV/JSON export cap; null = full history
  canGeneratePdf: boolean;          // false = on-screen preview only, no PDF file written
  consolidatedReport: boolean;      // multi-profile family report (Premium)
  familyDashboard: boolean;         // household dashboard (Premium)
  canUseOCR: boolean;               // wire only if/when OCR merges from feature branch
}

export const LIMITS: Record<Tier, TierLimits> = {
  free:    { maxProfiles: 1,  maxCustomParams: 0, historyWindowDays: 7,    exportWindowDays: 7,    canGeneratePdf: false, consolidatedReport: false, familyDashboard: false, canUseOCR: false },
  pro:     { maxProfiles: 2,  maxCustomParams: 4, historyWindowDays: null, exportWindowDays: null, canGeneratePdf: true,  consolidatedReport: false, familyDashboard: false, canUseOCR: true  },
  premium: { maxProfiles: 10, maxCustomParams: 8, historyWindowDays: null, exportWindowDays: null, canGeneratePdf: true,  consolidatedReport: true,  familyDashboard: true,  canUseOCR: true  },
};
// Backup/Restore is free on every tier -> not represented here; it always stores full data.

export const TIER_DISPLAY_NAME: Record<Tier, string> = {
  free: 'Free',
  pro: 'Pro',
  premium: 'Premium',
};
