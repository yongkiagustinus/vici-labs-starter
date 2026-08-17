import * as LocalAuthentication from "expo-local-authentication";

/**
 * Biometric / passcode lock on relaunch (VIC-10 scope). Falls back to the
 * device passcode when no biometrics are enrolled, and no-ops gracefully when
 * the hardware is unavailable (e.g. simulators) so the app is still usable.
 */

export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

export async function authenticate(): Promise<boolean> {
  if (!(await isBiometricAvailable())) return true; // don't lock users out
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock Vici Expense Tracker",
    fallbackLabel: "Use passcode",
    disableDeviceFallback: false,
  });
  return result.success;
}
