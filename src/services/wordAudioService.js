/**
 * Word Audio Service
 * Manages the word audio dictionary and handles generation of new words
 */

import { generateBatchAudio } from './elevenLabsApi';
import { fetchWordDictionary, updateWordDictionary, uploadAudioFile } from './audioStorage';

/**
 * Normalize a word for consistent lookup
 * @param {string} word - Word to normalize
 * @returns {string} Normalized word
 */
function normalizeWord(word) {
  return word.trim().toLowerCase();
}

/**
 * Extract words from message text
 * @param {string} text - Message text
 * @returns {string[]} Array of normalized words
 */
export function extractWords(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Split on whitespace and filter out empty strings
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 0)
    .map(normalizeWord);

  // Remove duplicates while preserving order
  return [...new Set(words)];
}

/**
 * Check which words from a message need audio generation
 * @param {string} messageText - The message to check
 * @returns {Promise<{existing: string[], missing: string[]}>} Words that exist vs need generation
 */
export async function checkWordsForAudio(messageText) {
  const words = extractWords(messageText);

  if (words.length === 0) {
    return { existing: [], missing: [] };
  }

  try {
    // Fetch the current word dictionary
    const dictionary = await fetchWordDictionary();

    const existing = [];
    const missing = [];

    for (const word of words) {
      if (dictionary[word]) {
        existing.push(word);
      } else {
        missing.push(word);
      }
    }

    console.log(`📊 Audio check: ${existing.length} existing, ${missing.length} missing`);
    return { existing, missing };
  } catch (error) {
    console.error('Failed to check words for audio:', error);
    // If dictionary fetch fails, assume all words are missing
    return { existing: [], missing: words };
  }
}

/**
 * Generate audio for new words and update the dictionary
 * @param {string[]} words - Array of words to generate audio for
 * @param {Function} onProgress - Optional progress callback (word, index, total)
 * @returns {Promise<{success: string[], failed: string[]}>} Results
 */
export async function generateAndStoreAudio(words, onProgress = null) {
  if (!words || words.length === 0) {
    return { success: [], failed: [] };
  }

  console.log(`🎤 Generating audio for ${words.length} word(s)...`);

  const success = [];
  const failed = [];

  try {
    // Generate audio for all words
    const audioMap = await generateBatchAudio(words);

    // Upload each audio file and update dictionary
    const dictionary = await fetchWordDictionary();

    for (let i = 0; i < words.length; i++) {
      const word = normalizeWord(words[i]);

      if (onProgress) {
        onProgress(word, i + 1, words.length);
      }

      const audioData = audioMap.get(word);

      if (!audioData) {
        console.error(`✗ No audio data generated for: "${word}"`);
        failed.push(word);
        continue;
      }

      try {
        // Upload audio file to storage
        const audioUrl = await uploadAudioFile(word, audioData);

        // Update dictionary with new entry
        dictionary[word] = {
          url: audioUrl,
          generatedAt: new Date().toISOString(),
        };

        success.push(word);
        console.log(`✓ Stored audio for: "${word}" at ${audioUrl}`);
      } catch (uploadError) {
        console.error(`✗ Failed to upload audio for: "${word}"`, uploadError);
        failed.push(word);
      }
    }

    // Save updated dictionary
    if (success.length > 0) {
      await updateWordDictionary(dictionary);
      console.log(`✓ Updated word dictionary with ${success.length} new word(s)`);
    }

    return { success, failed };
  } catch (error) {
    console.error('Failed to generate and store audio:', error);
    return { success, failed: words };
  }
}

/**
 * Generate audio for a message (only for words that don't exist yet)
 * @param {string} messageText - The message text
 * @param {Function} onProgress - Optional progress callback
 * @returns {Promise<{generated: string[], existing: string[], failed: string[]}>}
 */
export async function generateAudioForMessage(messageText, onProgress = null) {
  console.log(`🎵 Processing message for audio generation...`);

  // Check which words need generation
  const { existing, missing } = await checkWordsForAudio(messageText);

  if (missing.length === 0) {
    console.log('✓ All words already have audio!');
    return { generated: [], existing, failed: [] };
  }

  console.log(`📝 Need to generate audio for: ${missing.join(', ')}`);

  // Generate and store audio for missing words
  const { success, failed } = await generateAndStoreAudio(missing, onProgress);

  return {
    generated: success,
    existing,
    failed,
  };
}

/**
 * Get audio URLs for all words in a message
 * @param {string} messageText - The message text
 * @returns {Promise<Map<string, string>>} Map of word -> audio URL
 */
export async function getAudioUrlsForMessage(messageText) {
  const words = extractWords(messageText);
  const dictionary = await fetchWordDictionary();

  const audioUrls = new Map();

  for (const word of words) {
    const entry = dictionary[word];
    if (entry && entry.url) {
      audioUrls.set(word, entry.url);
    } else {
      console.warn(`⚠️ No audio found for word: "${word}"`);
    }
  }

  return audioUrls;
}
