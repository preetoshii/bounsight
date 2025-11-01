import { createAudioPlayer } from 'expo-audio';
import ReactNativeRichVibration from 'react-native-rich-vibration';
import { config } from '../config';

// Sound player cache
const soundPlayers = {};

// Load and cache a sound player
function loadSound(name, source, volume = 1.0) {
  if (soundPlayers[name]) {
    // Update volume on cached player
    soundPlayers[name].volume = volume;
    return soundPlayers[name];
  }

  try {
    const player = createAudioPlayer(source);
    player.volume = volume;
    soundPlayers[name] = player;
    return player;
  } catch (error) {
    console.warn(`Failed to load sound ${name}:`, error);
    return null;
  }
}

// Play a sound by name with optional haptic feedback
export async function playSound(name) {
  try {
    const soundMap = {
      'back-button': require('../sfx/back-button.wav'),
      'card-slide': require('../sfx/card-slide.wav'),
      'gelato-create': require('../sfx/gelato-create.wav'),
      'gelato-bounce': require('../sfx/gelato-bounce.wav'),
      'loss': require('../sfx/loss.wav'),
      'preview': require('../sfx/preview.wav'),
      'wall-bump': require('../sfx/wall-bump.wav'),
      'click': require('../sfx/click.wav'),
      'expand-card': require('../sfx/expand-card.wav'),
    };

    const source = soundMap[name];
    if (!source) {
      console.warn(`Sound ${name} not found`);
      return;
    }

    // Set volume: 20% for all except gelato-create (100%)
    const volume = name === 'gelato-create' ? 1.0 : 0.2;
    const player = loadSound(name, source, volume);

    if (player) {
      // Replay from beginning
      player.seekTo(0);
      player.play();
    }

    // Trigger haptic feedback for key game events using react-native-rich-vibration
    try {
      // Use runtime config if available (from haptics debug menu), otherwise use default
      const runtimeConfig = global.runtimeHapticsConfig || config.haptics;

      if (name === 'gelato-create') {
        ReactNativeRichVibration.vibrate(
          runtimeConfig.gelatoCreation.durationMs,
          runtimeConfig.gelatoCreation.intensity
        );
      } else if (name === 'gelato-bounce') {
        ReactNativeRichVibration.vibrate(
          runtimeConfig.gelatoBounce.durationMs,
          runtimeConfig.gelatoBounce.intensity
        );
      } else if (name === 'wall-bump') {
        ReactNativeRichVibration.vibrate(
          runtimeConfig.wallBump.durationMs,
          runtimeConfig.wallBump.intensity
        );
      } else if (name === 'loss') {
        ReactNativeRichVibration.vibrate(
          runtimeConfig.loss.durationMs,
          runtimeConfig.loss.intensity
        );
      }
    } catch (error) {
      // Silently fail haptics (not supported on all devices)
    }
  } catch (error) {
    console.warn(`Failed to play sound ${name}:`, error);
  }
}

// Setup audio (expo-audio handles configuration automatically)
export async function setupAudio() {
  // expo-audio doesn't require manual audio mode setup
  // Configuration happens automatically per platform
  console.log('Audio system ready (expo-audio)');
}
