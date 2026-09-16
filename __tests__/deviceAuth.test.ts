import { tryAuthenticate } from '../src/services/deviceAuth';

const LocalAuthentication = require('expo-local-authentication');

describe('tryAuthenticate (device auth is convenience-only, must fail open)', () => {
  beforeEach(() => {
    LocalAuthentication.hasHardwareAsync.mockReset();
    LocalAuthentication.isEnrolledAsync.mockReset();
    LocalAuthentication.authenticateAsync.mockReset();
  });

  test('returns true without prompting when no biometric/PIN is enrolled', async () => {
    LocalAuthentication.hasHardwareAsync.mockResolvedValue(false);
    LocalAuthentication.isEnrolledAsync.mockResolvedValue(false);

    const ok = await tryAuthenticate('test');
    expect(ok).toBe(true);
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
  });

  test('returns the authentication result when hardware is available and enrolled', async () => {
    LocalAuthentication.hasHardwareAsync.mockResolvedValue(true);
    LocalAuthentication.isEnrolledAsync.mockResolvedValue(true);
    LocalAuthentication.authenticateAsync.mockResolvedValue({ success: false });

    const ok = await tryAuthenticate('test');
    expect(ok).toBe(false);
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
  });

  test('fails open if the check throws', async () => {
    LocalAuthentication.hasHardwareAsync.mockRejectedValue(new Error('boom'));

    const ok = await tryAuthenticate('test');
    expect(ok).toBe(true);
  });
});
