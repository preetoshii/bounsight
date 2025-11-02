import { NativeModulesProxy } from 'expo-modules-core';

const ExpoCustomHaptics = NativeModulesProxy.ExpoCustomHaptics;

/**
 * Trigger haptic vibration with full control over duration and amplitude
 *
 * @param durationMs - Duration in milliseconds (any positive number, e.g. 1-1000ms)
 * @param amplitude - Vibration strength 1-255 (1 = softest, 255 = strongest)
 *
 * Android: Uses VibrationEffect.createOneShot() with amplitude control
 * iOS: Not implemented (use expo-haptics for iOS)
 */
export function vibrate(durationMs: number, amplitude: number): void {
  ExpoCustomHaptics?.vibrate(durationMs, amplitude);
}

/**
 * Cancel any ongoing vibration
 */
export function cancel(): void {
  ExpoCustomHaptics?.cancel();
}

/**
 * Check if device has vibrator hardware
 */
export function hasVibrator(): boolean {
  return ExpoCustomHaptics?.hasVibrator() ?? false;
}
