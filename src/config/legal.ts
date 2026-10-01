import { Linking, Alert } from 'react-native';

// Public legal/support site for Readiva (docs/CLAUDE-CODE-PROMPT-legal-links.md) — not
// published yet, so every URL in the app funnels through this one file, and every call
// site goes through openLegalUrl() rather than Linking.openURL directly, so a page that
// can't be reached fails gracefully instead of silently doing nothing or crashing.
export const SITE_BASE = 'https://readiva.wisdomveda.com';

export const LEGAL_URLS = {
  privacy: `${SITE_BASE}/privacy`,
  terms: `${SITE_BASE}/terms`,
  disclaimer: `${SITE_BASE}/disclaimer`,
  support: `${SITE_BASE}/support`,
} as const;

export type LegalUrlKey = keyof typeof LEGAL_URLS;

export const SUPPORT_EMAIL = 'support@wisdomveda.com';
export const APP_NAME = 'Readiva';

export const DISCLAIMER_SHORT_FIRST_LAUNCH =
  'Readiva helps you keep a record of your readings. It is not a medical device and does not give medical advice. Always talk to your doctor about your readings. In an emergency, call your local emergency number.';

export const DISCLAIMER_REPORT_FOOTER =
  'For personal record-keeping only. Not medical advice. Discuss these readings with your doctor.';

export async function openLegalUrl(key: LegalUrlKey): Promise<void> {
  const url = LEGAL_URLS[key];
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) throw new Error('URL not openable');
    await Linking.openURL(url);
  } catch {
    Alert.alert("Couldn't open the page", 'Please check your internet connection and try again.');
  }
}
