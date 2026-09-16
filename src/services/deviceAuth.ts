import * as LocalAuthentication from 'expo-local-authentication';

// Device auth here is convenience-only (per docs/PRODUCT-SPEC.md "Backup & Restore") —
// the Recovery Key remains the sole real safeguard. If the device has no biometric/PIN
// enrolled, or the check errors, we fail open rather than lock the user out of their
// own backup.
export async function tryAuthenticate(promptMessage: string): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) return true;
    const res = await LocalAuthentication.authenticateAsync({ promptMessage });
    return res.success;
  } catch {
    return true;
  }
}
