// Linking (unlike plain exports such as View/Text/Platform) needs the native
// bridge even just to be required — "Invariant Violation: __fbBatchedBridgeConfig
// is not set" under plain node/ts-jest. Alert.alert has the same issue. Mock the
// whole module rather than spying on the real one, scoped to this file only.
jest.mock('react-native', () => ({
  Linking: { canOpenURL: jest.fn(), openURL: jest.fn() },
  Alert: { alert: jest.fn() },
}));

import { openLegalUrl, LEGAL_URLS } from '../src/config/legal';

const { Linking, Alert } = require('react-native');

const FRIENDLY_ALERT = "Couldn't open the page. Please check your internet connection and try again.";

describe('openLegalUrl (CLAUDE-CODE-PROMPT-legal-links.md §1)', () => {
  beforeEach(() => {
    Linking.canOpenURL.mockReset();
    Linking.openURL.mockReset();
    Alert.alert.mockReset();
  });

  test('opens the URL when the device reports it as supported', async () => {
    Linking.canOpenURL.mockResolvedValue(true);
    Linking.openURL.mockResolvedValue(undefined);

    await openLegalUrl('privacy');

    expect(Linking.openURL).toHaveBeenCalledWith(LEGAL_URLS.privacy);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  test('shows the friendly alert instead of opening when the device reports no handler', async () => {
    Linking.canOpenURL.mockResolvedValue(false);
    Linking.openURL.mockResolvedValue(undefined);

    await openLegalUrl('terms');

    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(FRIENDLY_ALERT);
  });

  test('shows the friendly alert when openURL itself rejects (e.g. no network)', async () => {
    Linking.canOpenURL.mockResolvedValue(true);
    Linking.openURL.mockRejectedValue(new Error('network error'));

    await openLegalUrl('support');

    expect(Alert.alert).toHaveBeenCalledWith(FRIENDLY_ALERT);
  });
});
