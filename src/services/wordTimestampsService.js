/**
 * Word Timestamps Service
 *
 * Calls the word-timestamps API for precise word boundary detection (5-10ms accuracy)
 * using energy-based audio analysis instead of relying on Google STT timestamps.
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Analyze audio file and get precise word timestamps
 * @param {string} audioUri - URI to .m4a audio file
 * @param {Array} sentenceBreaks - Array of sentence break timestamps in ms (optional)
 * @returns {Promise<Object>} { text, words, wordTimings, wordAudioSegments }
 */
export async function getWordTimestamps(audioUri, sentenceBreaks = []) {
  try {
    console.log('Calling word-timestamps API...');
    console.log('Audio URI:', audioUri);

    // Convert blob URI to File object
    const response = await fetch(audioUri);
    const blob = await response.blob();
    const file = new File([blob], 'recording.m4a', { type: 'audio/m4a' });

    // Create form data
    const formData = new FormData();
    formData.append('file', file);

    // Call the API
    const apiResponse = await fetch(`${API_URL}/api/align`, {
      method: 'POST',
      body: formData,
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();

      // Handle 422 mismatch error specifically
      if (apiResponse.status === 422) {
        console.error('Word/segment mismatch:', errorData);
        throw new Error(
          `Word count (${errorData.details.words}) doesn't match detected segments (${errorData.details.segments}). ` +
          `Try recording with clearer pauses between words.`
        );
      }

      throw new Error(`API error: ${errorData.error || apiResponse.statusText}`);
    }

    const data = await apiResponse.json();
    console.log('Word timestamps API response:', data);

    // API now returns the correct format: { word, start, end }
    // where start/end are in milliseconds
    const wordTimings = data.words;

    // Insert sentence break markers if provided
    const timingsWithBreaks = insertSentenceBreaks(wordTimings, sentenceBreaks);

    // Extract word array and transcript text
    const wordsArray = timingsWithBreaks.map(w => w.word);
    const transcript = wordsArray.filter(w => w !== '*').join(' ');

    console.log('Transformed word timings:', timingsWithBreaks);

    // Note: We don't slice audio anymore - the new approach uses precise timestamps
    // so GameCore can seek directly to the right positions
    return {
      text: transcript,
      words: wordsArray,
      wordTimings: timingsWithBreaks,
      wordAudioSegments: null, // Not needed with new approach
      meta: data.meta, // Include metadata for debugging
    };
  } catch (error) {
    console.error('Word timestamps error:', error);
    throw error;
  }
}

/**
 * Insert sentence break markers (*) at specified timestamps
 * @param {Array} wordTimings - Array of {word, start, end}
 * @param {Array} breakTimestamps - Array of break timestamps in ms
 * @returns {Array} Word timings with break markers inserted
 */
function insertSentenceBreaks(wordTimings, breakTimestamps) {
  if (!breakTimestamps || breakTimestamps.length === 0) {
    return wordTimings;
  }

  const result = [];
  let breakIndex = 0;

  for (let i = 0; i < wordTimings.length; i++) {
    const timing = wordTimings[i];

    // Insert any break markers that come before this word
    while (breakIndex < breakTimestamps.length && breakTimestamps[breakIndex] < timing.start) {
      const breakTime = breakTimestamps[breakIndex];
      result.push({
        word: '*',
        start: breakTime,
        end: breakTime,
      });
      breakIndex++;
    }

    // Add the word
    result.push(timing);
  }

  // Add any remaining break markers at the end
  while (breakIndex < breakTimestamps.length) {
    const breakTime = breakTimestamps[breakIndex];
    result.push({
      word: '*',
      start: breakTime,
      end: breakTime,
    });
    breakIndex++;
  }

  return result;
}
