/**
 * ElevenLabs TTS API integration
 * Generates speech audio for individual words
 */

// ElevenLabs configuration
const ELEVENLABS_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY || null,
  voiceId: process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM', // Default voice: Rachel
  modelId: 'eleven_monolingual_v1', // Fast, reliable model for single words
  baseUrl: 'https://api.elevenlabs.io/v1',
};

/**
 * Generate audio for a single word using ElevenLabs TTS
 * @param {string} word - The word to generate audio for
 * @returns {Promise<ArrayBuffer>} Audio data as ArrayBuffer
 */
export async function generateWordAudio(word) {
  const { apiKey, voiceId, modelId, baseUrl } = ELEVENLABS_CONFIG;

  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured. Set EXPO_PUBLIC_ELEVENLABS_API_KEY in environment.');
  }

  // Normalize word for consistency
  const normalizedWord = word.trim().toLowerCase();

  if (!normalizedWord) {
    throw new Error('Cannot generate audio for empty word');
  }

  try {
    const url = `${baseUrl}/text-to-speech/${voiceId}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: normalizedWord,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Return audio data as ArrayBuffer
    return await response.arrayBuffer();
  } catch (error) {
    console.error(`Failed to generate audio for word "${normalizedWord}":`, error);
    throw error;
  }
}

/**
 * Generate audio for multiple words in batch
 * Returns a map of word -> audio data
 * @param {string[]} words - Array of words to generate
 * @returns {Promise<Map<string, ArrayBuffer>>} Map of normalized word -> audio data
 */
export async function generateBatchAudio(words) {
  const audioMap = new Map();
  const errors = [];

  // Generate audio for each word sequentially (ElevenLabs rate limits apply)
  for (const word of words) {
    const normalizedWord = word.trim().toLowerCase();

    if (!normalizedWord || audioMap.has(normalizedWord)) {
      continue; // Skip empty or duplicate words
    }

    try {
      const audioData = await generateWordAudio(normalizedWord);
      audioMap.set(normalizedWord, audioData);
      console.log(`✓ Generated audio for: "${normalizedWord}"`);

      // Small delay to respect rate limits (adjust as needed)
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`✗ Failed to generate audio for: "${normalizedWord}"`, error);
      errors.push({ word: normalizedWord, error });
    }
  }

  if (errors.length > 0) {
    console.warn(`Failed to generate audio for ${errors.length} word(s):`, errors);
  }

  return audioMap;
}

/**
 * Test the ElevenLabs API connection
 * @returns {Promise<boolean>} True if API is configured and working
 */
export async function testElevenLabsConnection() {
  try {
    await generateWordAudio('hello');
    console.log('✓ ElevenLabs API connection successful');
    return true;
  } catch (error) {
    console.error('✗ ElevenLabs API connection failed:', error);
    return false;
  }
}
