# Prompt for Claude Code: add legal and support links to the app

Paste everything below the line into Claude Code, run on a new branch (for example `feature/legal-links`).

---

## Goal
Make the app link to its public legal and support pages, and show the required disclaimers, in the places listed below. The pages will live at `https://readiva.wisdomveda.com`. They are not published yet, so every URL must come from one config file and the app must behave sensibly if a page can't be opened.

## Rules
- Do only what is listed. Do not change pricing, features, the database, the `android/` or `ios/` folders, app config, or anything unrelated.
- Add **no new dependency**. Open links with React Native's `Linking`. Get the app version from `expo-constants` only if it is already installed; otherwise skip the version line and tell me.
- No analytics, no network calls, nothing that sends data anywhere.
- Follow the existing code style, components and theme. Read the existing onboarding service (`src/services/onboarding.ts`), the Settings screen, `src/services/pdf.ts` and `src/screens/ReportScreen.tsx` before you change them, and extend them rather than duplicating.
- Use the exact text given below. Do not rewrite the wording.

## 1. One config file
Create `src/config/legal.ts` exporting:
```ts
export const SITE_BASE = 'https://readiva.wisdomveda.com';
export const LEGAL_URLS = {
  privacy: `${SITE_BASE}/privacy`,
  terms: `${SITE_BASE}/terms`,
  disclaimer: `${SITE_BASE}/disclaimer`,
  support: `${SITE_BASE}/support`,
};
export const SUPPORT_EMAIL = 'support@wisdomveda.com';
export const APP_NAME = 'Readiva';
export const DISCLAIMER_SHORT_FIRST_LAUNCH =
  'Readiva helps you keep a record of your readings. It is not a medical device and does not give medical advice. Always talk to your doctor about your readings. In an emergency, call your local emergency number.';
export const DISCLAIMER_REPORT_FOOTER =
  'For personal record-keeping only. Not medical advice. Discuss these readings with your doctor.';
```
Add a small helper `openLegalUrl(key)` that calls `Linking.canOpenURL` / `Linking.openURL` and, if it fails, shows a friendly alert: "Couldn't open the page. Please check your internet connection and try again."

## 2. Reusable link row component
Create a small reusable component (for example `src/components/LegalLinks.tsx`) that renders tappable text links for Privacy Policy, Terms of Service and Medical Disclaimer. It must be usable inline (a row of links) and as a list. It will be reused on the paywall later. Large tap targets, readable text, accessible labels.

## 3. Settings → About
In the Settings screen add an **About** section containing:
- "Privacy Policy", "Terms of Service", "Medical Disclaimer" (each opens its page via `openLegalUrl`)
- "Support" row showing `SUPPORT_EMAIL` that opens `mailto:` and also offers the support page link
- App version (from `expo-constants`, if available)
- The line: "Your data stays on your device."
Keep it visually consistent with the other Settings rows.

## 4. First-launch screen
Extend the existing onboarding flow (reuse the existing stored-flag mechanism in `onboarding.ts`; do not create a second flag system). On first launch only, show a single screen with:
1. "Your readings stay on this phone. We can't see them or recover them."
2. "Make a backup now and then. It is free on every plan."
3. The text `DISCLAIMER_SHORT_FIRST_LAUNCH`
4. Links to the Terms of Service and Privacy Policy (use the `LegalLinks` component)
5. A **Continue** button. Tapping Continue is the acceptance. Do **not** use a pre-ticked checkbox.
If an onboarding screen already exists, add this content to it instead of adding another screen, and tell me what you changed.

## 5. Report footer
In the report preview (`ReportScreen.tsx`) and in the generated PDF (`pdf.ts`), add the line `DISCLAIMER_REPORT_FOOTER` as a footer at the bottom. In the PDF it should be on every page if the structure allows, otherwise at the end of the document. Do not change any other report content.

## 6. Paywall (it exists: `src/screens/PaywallScreen.tsx`)
- Add the `LegalLinks` component (Terms of Service and Privacy Policy) under the purchase buttons and Restore Purchases. Apple requires both on this screen.
- Add this renewal text near the buttons, using the store's own price strings, never hardcoded prices: "Renews automatically until you cancel. Cancel any time in your App Store or Google Play subscription settings, at least 24 hours before renewal. Payment is charged to your account when you confirm. If a subscription ends, your data is never deleted; some features lock until you resubscribe."
- Change the screen title from "Health Diary Plans" to "Readiva Plans".

## 7. Replace the old name in user-facing text
The app was renamed to Readiva, but these user-visible strings still say "Health Diary". Change the visible text only. Do **not** rename the repo, the `slug`, file names or code identifiers:
- `src/components/FirstRunKeyChoiceModal.tsx` (welcome title and button labels)
- `src/screens/SettingsScreen.tsx` (the info banner)
- `src/services/dataExport.ts` (share titles for the CSV and JSON export)
- `src/services/pdf.ts` (the Recovery Key document heading)
- `src/services/pdfDownload.ts` (the save-report share title)
- `src/services/diagnosticsLog.ts` (share title and the email subject)
- the comment in `PaywallScreen.tsx` can stay. Then search the whole `src/` folder for any other user-visible "Health Diary" and list what you changed.

## 8. Fix how paywall packages are matched to store products
`PaywallScreen.tsx` finds each plan with `p.product.identifier === productId` using `pro_monthly`, `pro_annual`, `premium_monthly` and `premium_annual`. On Google Play, RevenueCat reports subscription product identifiers as `subscriptionId:basePlanId` (for example `pro_monthly:p1m`), so an exact match fails there and the screen would silently fall back to hardcoded prices and a null package. Change `findPackage` so it compares the part before any colon: `p.product.identifier.split(':')[0] === productId`. Keep the same four product IDs. Add a unit test covering both a plain identifier (iOS style) and a colon identifier (Android style).

## Tests and checks
- Unit test `openLegalUrl` (success and failure paths) with `Linking` mocked.
- A component test that the paywall footer shows the legal links and renewal text.
- A component test that the About section renders the three legal links and the support row.
- A test that the first-launch screen shows once and not again after Continue.
- Run the existing test suite and the TypeScript check. Nothing that passed before should fail.
- Do not run any `expo prebuild` or native build.

## When finished
Tell me: the files you added or changed, anything you couldn't do and why, and a manual test checklist (how to see each link and the first-launch screen on the dev client). Do not merge; leave the branch for me to review.
