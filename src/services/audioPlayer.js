/**
 * Audio Player Service
 * Handles loading and playback of word audio files
 */

import { Audio } from 'expo-av';
import { getAudioUrlsForMessage } from './wordAudioService';
import { fetchAudioFile } from './audioStorage';

// In-memory cache of loaded audio Sound objects
const audioCache = new Map(); // word -> Sound object

// Current message's audio URLs
let currentMessageAudioUrls = new Map(); // word -> URL

/**
 * Preload audio files for a message
 * Downloads and decodes all word audio for the given message
 * @param {string} messageText - The message text
 * @param {Function} onProgress - Optional progress callback (word, current, total)
 * @returns {Promise<{loaded: string[], failed: string[]}>}
 */
export async function preloadMessageAudio(messageText, onProgress = null) {
  console.log('🎵 Preloading audio for message...');

  try {
    // Get audio URLs for all words in the message
    const audioUrls = await getAudioUrlsForMessage(messageText);
    currentMessageAudioUrls = audioUrls;

    const words = Array.from(audioUrls.keys());
    const loaded = [];
    const failed = [];

    if (words.length === 0) {
      console.log('⚠️ No audio URLs found for message');
      return { loaded, failed };
    }

    console.log(`📥 Loading audio for ${words.length} word(s)...`);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const url = audioUrls.get(word);

      if (onProgress) {
        onProgress(word, i + 1, words.length);
      }

      // Skip if already cached
      if (audioCache.has(word)) {
        console.log(`✓ Using cached audio for: "${word}"`);
        loaded.push(word);
        continue;
      }

      try {
        // Load audio file as Sound object
        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: false }
        );

        audioCache.set(word, sound);
        loaded.push(word);
        console.log(`✓ Loaded audio for: "${word}"`);
      } catch (error) {
        console.error(`✗ Failed to load audio for: "${word}"`, error);
        failed.push(word);
      }
    }

    console.log(`✓ Preload complete: ${loaded.length} loaded, ${failed.length} failed`);
    return { loaded, failed };
  } catch (error) {
    console.error('Failed to preload message audio:', error);
    throw error;
  }
}

/**
 * Play audio for a specific word
 * @param {string} word - The word to play audio for
 * @returns {Promise<boolean>} True if playback started successfully
 */
export async function playWordAudio(word) {
  const normalizedWord = word.trim().toLowerCase();

  const sound = audioCache.get(normalizedWord);

  if (!sound) {
    console.warn(`⚠️ No audio loaded for word: "${normalizedWord}"`);
    return false;
  }

  try {
    // Reset to beginning and play
    await sound.setPositionAsync(0);
    await sound.playAsync();
    console.log(`🔊 Playing audio for: "${normalizedWord}"`);
    return true;
  } catch (error) {
    console.error(`Failed to play audio for "${normalizedWord}":`, error);
    return false;
  }
}

/**
 * Stop all playing audio
 */
export async function stopAllAudio() {
  for (const [word, sound] of audioCache) {
    try {
      await sound.stopAsync();
    } catch (error) {
      console.error(`Failed to stop audio for "${word}":`, error);
    }
  }
}

/**
 * Clear the audio cache (unload all sounds)
 */
export async function clearAudioCache() {
  console.log('🗑️ Clearing audio cache...');

  for (const [word, sound] of audioCache) {
    try {
      await sound.unloadAsync();
    } catch (error) {
      console.error(`Failed to unload audio for "${word}":`, error);
    }
  }

  audioCache.clear();
  currentMessageAudioUrls.clear();
  console.log('✓ Audio cache cleared');
}

/**
 * Check if audio is loaded for a word
 * @param {string} word - The word to check
 * @returns {boolean}
 */
export function isAudioLoaded(word) {
  const normalizedWord = word.trim().toLowerCase();
  return audioCache.has(normalizedWord);
}

/**
 * Get list of all cached words
 * @returns {string[]}
 */
export function getCachedWords() {
  return Array.from(audioCache.keys());
}
