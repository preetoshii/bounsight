import { Platform } from 'react-native';
import * as ExpoHaptics from 'expo-haptics';
import * as CustomHaptics from '../../modules/expo-custom-haptics';
import { config } from '../config';

/**
 * Unified haptics API that routes to the appropriate platform implementation
 *
 * Android: Uses custom expo-custom-haptics module for precise duration + amplitude control
 * iOS: Uses expo-haptics with native haptic engine (preset impact styles)
 * Web: No-op (haptics not supported)
 */

// Map iOS style strings to Expo Haptics constants
const IOS_IMPACT_STYLES = {
  'light': ExpoHaptics.ImpactFeedbackStyle.Light,
  'medium': ExpoHaptics.ImpactFeedbackStyle.Medium,
  'heavy': ExpoHaptics.ImpactFeedbackStyle.Heavy,
  'soft': ExpoHaptics.ImpactFeedbackStyle.Soft,
  'rigid': ExpoHaptics.ImpactFeedbackStyle.Rigid,
};

/**
 * Trigger haptic feedback for a specific event
 * Automatically selects the correct platform API and settings
 *
 * @param {string} eventName - Name of haptic event from config (e.g. 'gelatoCreation')
 * @param {object} runtimeConfig - Optional runtime config from debug menu (overrides default)
 */
export function triggerHaptic(eventName, runtimeConfig = null) {
  if (Platform.OS === 'web') {
    return; // Haptics not supported on web
  }

  try {
    // Use runtime config if provided (from debug menu), otherwise use default config
    const hapticsConfig = runtimeConfig || config.haptics;
    const eventConfig = hapticsConfig[eventName];

    if (!eventConfig) {
      console.warn(`Haptic event '${eventName}' not found in config`);
      return;
    }

    // Skip if explicitly disabled (for drawing haptics)
    if (eventConfig.enabled === false) {
      return;
    }

    if (Platform.OS === 'android') {
      // Android: Use custom module with duration + amplitude
      const { durationMs, amplitude } = eventConfig.android || eventConfig;

      if (durationMs !== undefined && amplitude !== undefined) {
        CustomHaptics.vibrate(durationMs, amplitude);
      }
    } else if (Platform.OS === 'ios') {
      // iOS: Use Expo Haptics with preset styles
      const iosStyle = eventConfig.ios || eventConfig;
      const impactStyle = typeof iosStyle === 'string'
        ? IOS_IMPACT_STYLES[iosStyle]
        : IOS_IMPACT_STYLES.light;

      ExpoHaptics.impactAsync(impactStyle);
    }
  } catch (error) {
    // Silently fail haptics (not critical to gameplay)
    console.warn('Haptic feedback failed:', error);
  }
}

/**
 * Trigger drawing haptic (called frequently during touch drag)
 * Uses special handling for high-frequency haptic ticks
 *
 * @param {object} runtimeConfig - Optional runtime config from debug menu
 */
export function triggerDrawingHaptic(runtimeConfig = null) {
  triggerHaptic('drawing', runtimeConfig);
}
