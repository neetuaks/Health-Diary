# Health Diary — Paywall & Subscription Spec

Instruction document for implementing the freemium/subscription paywall. Hand this to Claude Code. Local-only, no-account architecture — subscription funds ongoing maintenance/improvement, **not** cloud storage. **Pricing is LOCKED (see PRICING-CHART.md).**

---

## 1. Model and non-negotiable principles

- **Subscription, not one-time.** Two paid tiers (Pro, Premium), each **monthly + annual** (annual = 2 months free, and is the hero price shown first). Plus a permanent Free tier. **No free trial** — the Free tier is the trial.
- **Enforcement without a backend.** No app server. Subscription state is validated against the store (App Store / Google Play) via **RevenueCat**, whose SDK caches entitlement locally and works offline after first check. Do **not** build server-side validation or heavy anti-piracy — for a ₹149–249/mo consumer app, store-validated receipts are enough.
- **Data is never lost, and never deleted, on any tier.** Encrypted Backup & Restore is FREE for everyone and always stores the **complete** dataset. Readings are never deleted by any tier logic.
- **Gating is on VIEW, CREATION, and polished output — never on data preservation.** The Free 7-day window caps what is *shown in-app* and what *CSV/JSON export* produces; older data is retained and unlocks on upgrade. See §2.
- **A downgrade or lapse NEVER deletes data.** Excess profiles/custom-params beyond the new tier are **locked, not deleted**, restored on re-subscribe. See §7.
- **No Archive feature.** Health readings are tiny; long histories never bloat the DB or backups. Cleanup (if wanted) is the existing bulk-delete after a free export/backup. Do not build archive.

---

## 2. Tier matrix (LOCKED — single source of truth)

| Capability | Free — ₹0 | Pro "Personal" — ₹149/mo · ₹1,490/yr | Premium "Family" — ₹249/mo · ₹2,490/yr |
|---|---|---|---|
| Built-in parameters (BP, Glucose) | ✅ | ✅ | ✅ |
| Custom parameter types | 0 | up to **4** | up to **8** |
| Max profiles | **1** | **2** | **10** |
| In-app data visibility | last **7 days** | **full history** | **full history** |
| CSV / JSON export | ✅ **last 7 days only** | ✅ full history | ✅ full history |
| Encrypted Backup & Restore (stores full data) | ✅ | ✅ | ✅ |
| PDF doctor report | **preview only** (locked, no file) | ✅ generate + **download** + history | ✅ generate + download + history |
| **Consolidated family report** (multi-profile PDF) | ❌ | ❌ | ✅ |
| **Family dashboard** (everyone's latest at a glance) | ❌ | ❌ | ✅ |
| OCR photo entry | ❌ | ✅ *(when it ships from feature branch)* | ✅ *(when it ships)* |
| Priority support + earliest new features | — | — | ✅ |

**The positioning ladder — sell by identity, not counts:** Free = "just me, this week" → Pro = "my full record, over time" → Premium = "my family, together."

**The only gated *data* feature is the polished PDF report.** Raw data (CSV/JSON) and disaster recovery (Backup/Restore) are free — a disciplined Free user can keep everything forever via weekly export + backup. The 7-day cap is resource protection (not rendering/exporting heavy history for free), never data lock-out.

All numbers live in ONE config (`src/services/limits.ts`), never hard-coded at call sites.

---

## 3. Entitlement architecture

**One config, one hook, one source of truth. No feature check reads RevenueCat directly.**

**`src/services/limits.ts`** — pure config, no SDK imports:
```ts
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
```
(Backup/Restore is free on every tier → not represented here; it always stores full data.)

**`src/services/entitlement.tsx`** — `EntitlementProvider` + `useEntitlement()`:
- Wraps the app in `App.tsx`, above navigation.
- Maps RevenueCat `customerInfo` → `Tier` (`premium` entitlement → premium, else `pro` → pro, else free).
- Exposes `{ tier, limits, isPro, isPremium, refresh(), customerInfo }`, `limits = LIMITS[tier]`.
- Subscribes to RevenueCat's `customerInfo` listener so UI reacts immediately to purchase/restore/expiry.
- **Fails closed to `free`** when offline-with-no-cache or RevenueCat is unavailable — but must NEVER block the app from opening or block logging.

**Every gate reads `useEntitlement().limits`, never the SDK.**

---

## 4. Gate-by-gate checklist

Each gate: check the limit; when exceeded, show an **upgrade prompt that deep-links to the Paywall** (§5) — never a dead-end alert.

1. **Add Profile** (`ProfileManager.tsx`): if `activeProfileCount >= limits.maxProfiles` → upgrade prompt. (Free 1, Pro 2, Premium 10.)
2. **Add Parameter Type** (`ParameterTypesScreen.tsx`): count custom types (`is_builtin = 0`); if `>= limits.maxCustomParams` → upgrade prompt. Free (0) → the button routes to paywall. Built-in BP/Glucose never counted/gated.
3. **In-app visibility** (`DiaryScreen`, `ChartScreen`, `ReportScreen`): when `historyWindowDays` is set, filter to `recorded_at >= now - historyWindowDays`. Don't hide silently — show a banner: *"Showing last 7 days. See your full history with Pro."* → paywall.
4. **CSV/JSON export** (`dataExport.ts` callers): when `exportWindowDays` is set (Free), the export includes only readings within that window. Add a note in the export UI: *"Free export covers the last 7 days. Upgrade for full history."* Paid (`null`) → full dataset. **Backup is separate and always full** (do not apply the window to backup).
5. **OCR entry** (`PhotoEntryModal` / New Record): only once OCR merges to production — if `!limits.canUseOCR`, the "From Photo" method routes to paywall. Until merged, keep off.
6. **Custom-param → profile assignment**: choosing which profiles a custom parameter applies to is a free UI feature, NOT a paywall axis. Only the *count* of custom types is gated (#2).
7. **PDF report** (`ReportScreen.tsx`): tab is **always visible** on every tier.
   - Free (`!canGeneratePdf`): render on-screen **preview only** (7-day window, "Preview" watermark). The **Download PDF** control routes to the paywall. **Do not write a PDF file at all on Free** — nothing to work around the gate.
   - Pro/Premium (`canGeneratePdf`): full report + **Download PDF** + PDF history (see §6).
8. **Consolidated family report** (`consolidatedReport`, Premium only) and **Family dashboard** (`familyDashboard`, Premium only): see the separate **FAMILY-FEATURES-SPEC.md**. On Pro/Free, entry points route to the paywall.

---

## 5. Paywall / Pricing screen (`src/screens/PaywallScreen.tsx`)

Reachable from Settings ("Upgrade") and every §4 upgrade prompt.
- **Three plan cards** (Free / Pro / Premium) from the §2 matrix, in plain language, with the identity framing ("For me" / "For my family").
- **Annual is the hero:** show annual price first (₹1,490 / ₹2,490) as the anchor; monthly (₹149 / ₹249) secondary. Per-day framing helps ("≈ ₹5/day", "≈ ₹8/day"). Prefer store-native `package.product.priceString` over hard-coded numbers so regional pricing stays correct.
- Badge **Premium "Most popular for families."**
- **CTAs** → `Purchases.purchasePackage(pkg)`. **Restore Purchases** → `Purchases.restorePurchases()`. **Manage Subscription** → store-native page.
- Line: *"Your subscription funds ongoing improvements and keeps the app ad-free. Your health data always stays on your device."*
- On success: call `refresh()` and return the user to where they were, now unlocked.

---

## 6. PDF report output model (download, not share) + PDF history

Owner decision: **no in-app "Share" button.** Instead, the app generates the PDF and lets the user **save it as a file they own**; they share it themselves from their file manager. This keeps the app from invoking a share sheet and reinforces the local-only/privacy story.

- **Generate + Download** (Pro/Premium): build the PDF with `expo-print` (`printToFileAsync`) into the app document directory, then **save it to the device**:
  - **Android:** save to the Downloads folder (Storage Access Framework / MediaStore).
  - **iOS:** no shared Downloads folder — present the Files "save to…" flow so the user picks a location.
  - Use a **download icon** for this action (not a share glyph). Optional secondary: **Print** via `Print.printAsync`.
- **PDF history** (Pro/Premium): keep generated PDFs in the app document directory plus a small local index (`id`, `generatedAt`, `profileIds[]`, `dateRange`, `filePath`, `type: single | consolidated`). A "Report history" list lets the user re-open, re-download/save, and delete past reports. This is local-only; nothing syncs.
  - PDFs are larger than readings (hundreds of KB). Let the user delete individual history items; consider a soft cap or a "clear history" action so it can't grow unbounded.
- **Free:** no PDF is ever generated (preview only), so there is no history for Free.

---

## 7. Non-destructive downgrade / expiry rules (implement exactly)

When `tier` drops, **nothing is deleted** — excess is locked and restored on re-subscribe.
- **Profiles over the new limit:** keep all profiles + readings; mark those beyond `maxProfiles` as **locked** (greyed, non-selectable). Let the user choose which stay active within the limit (don't auto-pick). Unlock on upgrade.
- **Custom parameter types over the new limit:** keep definitions + readings; lock the excess (no new logging to a locked type); unlock on upgrade in the user's chosen order.
- **Visibility/export windows shrink:** older readings are re-filtered from view/export (never deleted). No data operation runs on downgrade. Backup still stores everything.
- **PDF history:** past PDFs remain on device and viewable even if the user lapses to Free (they're just files); only *generating new* PDFs is Pro+.
- **Grace period:** honor RevenueCat's billing grace period — a failed auto-renew doesn't instantly lock the user out.

---

## 8. RevenueCat + store setup

1. Add `react-native-purchases` (+ optional `react-native-purchases-ui`). **Native module — dev client only, not Expo Go.** Add the Expo config plugin, rebuild.
2. Create subscription products in **Play Console** and **App Store Connect**:
   - `pro_monthly` ₹149, `pro_annual` ₹1,490
   - `premium_monthly` ₹249, `premium_annual` ₹2,490
   - (Stores handle INR + UPI etc.; they take 15–30% — expected.)
3. In **RevenueCat**: entitlements `pro` and `premium`; attach products; one **Offering** with all four packages for the paywall.
4. `Purchases.configure({ apiKey, appUserID: <anonymous> })` at app start — **no personal identifier** (anonymous ID; the app has no accounts).
5. Entitlement cached by the SDK → gates work offline after first launch. Never block app open on a network check.

---

## 9. Privacy disclosure (must do)

RevenueCat transmits **purchase/subscription data only** (never health data). So:
- Privacy notice / About: health data stays on-device; payment processing via RevenueCat + the store handles only purchase records.
- Update App Store "App Privacy" and Play "Data Safety" to list RevenueCat as a purchases processor.
- Always pass **anonymous** app user IDs.
- State on the paywall that health data never leaves the device, so subscribing isn't a privacy compromise.

---

## 10. Tests to add

- `limits.ts` mapping per tier.
- Entitlement mapping: `premium`/`pro`/none → correct tier; offline-no-cache → `free`, app still opens and logs.
- Profile + custom-param gates: at-limit vs under-limit.
- In-app visibility filter: reading older than window excluded for Free, included for paid.
- **Export window:** Free export contains only last-7-days rows; paid contains all. **Backup always contains all rows on every tier** (assert Free backup is full).
- **PDF gate:** Free → preview renders, no PDF file written, Download routes to paywall; Pro/Premium → PDF generated, saved, and added to history.
- **Downgrade non-destructive:** Premium→Free deletes no rows; only lock flags change; backup still full.
- Restore purchases resolves entitlement.
