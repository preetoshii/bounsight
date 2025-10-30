/**
 * Google Cloud Speech-to-Text Service
 *
 * Transcribes audio recordings using Google Cloud Speech-to-Text API
 * Returns transcript text + word-level timestamps
 *
 * API Docs: https://cloud.google.com/speech-to-text/docs/sync-recognize
 */

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY;
const API_ENDPOINT = 'https://speech.googleapis.com/v1/speech:recognize';

/**
 * Convert blob URI to base64 string
 * @param {string} blobUri - Blob URL (e.g., blob:http://localhost:8082/...)
 * @returns {Promise<string>} Base64-encoded audio content
 */
async function blobToBase64(blobUri) {
  const response = await fetch(blobUri);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Remove data URL prefix (e.g., "data:audio/webm;base64,")
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Parse time offset string to milliseconds
 * Google returns time as "1.500s" format
 * @param {string} timeStr - Time string (e.g., "1.500s" or "0s")
 * @returns {number} Time in milliseconds
 */
function parseTimeOffset(timeStr) {
  if (!timeStr) return 0;
  // Remove 's' suffix and convert to milliseconds
  const seconds = parseFloat(timeStr.replace('s', ''));
  return Math.round(seconds * 1000);
}

/**
 * Insert sentence break markers at specified timestamps
 * @param {Array} words - Array of word objects from Google API
 * @param {Array} breakTimestamps - Array of sentence break timestamps in milliseconds
 * @returns {Array} Words array with "*" markers inserted
 */
function insertSentenceBreaks(words, breakTimestamps) {
  if (!breakTimestamps || breakTimestamps.length === 0) {
    return words;
  }

  const result = [];
  let breakIndex = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordStartMs = parseTimeOffset(word.startTime);

    // Insert any break markers that come before this word
    while (breakIndex < breakTimestamps.length && breakTimestamps[breakIndex] < wordStartMs) {
      const breakTime = breakTimestamps[breakIndex];
      result.push({
        word: '*',
        startTime: `${(breakTime / 1000).toFixed(3)}s`,
        endTime: `${(breakTime / 1000).toFixed(3)}s`,
      });
      breakIndex++;
    }

    // Add the word
    result.push(word);
  }

  // Add any remaining break markers at the end
  while (breakIndex < breakTimestamps.length) {
    const breakTime = breakTimestamps[breakIndex];
    result.push({
      word: '*',
      startTime: `${(breakTime / 1000).toFixed(3)}s`,
      endTime: `${(breakTime / 1000).toFixed(3)}s`,
    });
    breakIndex++;
  }

  return result;
}

/**
 * Transcribe audio using Google Cloud Speech-to-Text API
 * @param {string} audioUri - Blob URI of recorded audio
 * @param {Array} sentenceBreaks - Array of sentence break timestamps in milliseconds
 * @returns {Promise<Object>} Transcription result with text, words, and wordTimings
 */
export async function transcribeAudio(audioUri, sentenceBreaks = []) {
  try {
    console.log('Starting transcription...');
    console.log('Audio URI:', audioUri);
    console.log('Sentence breaks:', sentenceBreaks);

    // Convert blob to base64
    const audioContent = await blobToBase64(audioUri);
    console.log('Audio converted to base64, length:', audioContent.length);

    // Prepare API request
    const requestBody = {
      config: {
        encoding: 'WEBM_OPUS', // Web audio format
        sampleRateHertz: 48000, // Standard web audio sample rate
        languageCode: 'en-US',
        enableWordTimeOffsets: true, // Get word-level timestamps
        enableAutomaticPunctuation: true, // Add punctuation
      },
      audio: {
        content: audioContent,
      },
    };

    // Call Google Cloud Speech-to-Text API
    const response = await fetch(`${API_ENDPOINT}?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    console.log('Transcription response:', data);

    // Extract results
    if (!data.results || data.results.length === 0) {
      throw new Error('No transcription results returned');
    }

    const alternative = data.results[0].alternatives[0];
    const transcript = alternative.transcript;
    let words = alternative.words || [];

    // Insert sentence break markers
    words = insertSentenceBreaks(words, sentenceBreaks);

    // Convert to our format
    const wordsArray = words.map(w => w.word);
    const wordTimings = words.map(w => ({
      word: w.word,
      start: parseTimeOffset(w.startTime),
      end: parseTimeOffset(w.endTime),
    }));

    console.log('Transcription complete!');
    console.log('Text:', transcript);
    console.log('Words:', wordsArray);
    console.log('Word timings:', wordTimings);

    // Slice audio into individual word segments
    console.log('Slicing audio into word segments...');
    const { sliceAudioIntoWords } = await import('./audioSlicingService');
    const wordAudioSegments = await sliceAudioIntoWords(audioUri, wordTimings);

    return {
      text: transcript,
      words: wordsArray,
      wordTimings,
      wordAudioSegments, // Array of {word, blobUri} for each word
    };
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}
