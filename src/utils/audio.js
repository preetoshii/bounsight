import { Audio } from 'expo-av';

// Sound objects cache
const sounds = {};

// Load and cache a sound
async function loadSound(name, source) {
  if (sounds[name]) return sounds[name];

  try {
    const { sound } = await Audio.Sound.createAsync(source);
    sounds[name] = sound;
    return sound;
  } catch (error) {
    console.warn(`Failed to load sound ${name}:`, error);
    return null;
  }
}

// Play a sound by name
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
    };

    const source = soundMap[name];
    if (!source) {
      console.warn(`Sound ${name} not found`);
      return;
    }

    const sound = await loadSound(name, source);
    if (sound) {
      await sound.replayAsync();
    }
  } catch (error) {
    console.warn(`Failed to play sound ${name}:`, error);
  }
}

// Configure audio mode once at app start
export async function setupAudio() {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
  } catch (error) {
    console.warn('Failed to setup audio:', error);
  }
}
