/**
 * Audio Slicing Service
 * Slices recorded audio into individual word segments using Web Audio API
 * Works cross-platform (web, iOS, Android)
 */

/**
 * Slice audio blob into individual word segments
 * @param {string} audioBlobUri - The blob URI of the full recording
 * @param {Array} wordTimings - Array of {word, start, end} in milliseconds
 * @returns {Promise<Array>} Array of {word, blobUri} for each word segment
 */
export async function sliceAudioIntoWords(audioBlobUri, wordTimings) {
  console.log('Starting audio slicing for', wordTimings.length, 'words');

  // Fetch the audio blob
  const response = await fetch(audioBlobUri);
  const audioBlob = await response.blob();

  // Convert blob to ArrayBuffer
  const arrayBuffer = await audioBlob.arrayBuffer();

  // Create audio context
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  // Decode the audio data
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  console.log('Audio decoded:', {
    duration: audioBuffer.duration,
    sampleRate: audioBuffer.sampleRate,
    channels: audioBuffer.numberOfChannels,
  });

  // Slice each word
  const wordBlobs = [];

  for (let i = 0; i < wordTimings.length; i++) {
    const timing = wordTimings[i];

    // Skip sentence break markers
    if (timing.word === '*') {
      wordBlobs.push({
        word: '*',
        blobUri: null,
      });
      continue;
    }

    // Convert milliseconds to seconds
    const startTime = timing.start / 1000;
    const endTime = timing.end / 1000;
    const duration = endTime - startTime;

    // Add padding to trim leading silence - Google's timestamps may be slightly early
    // Start the slice 50-100ms later to skip initial silence/breath sounds
    const TRIM_START_MS = 80; // Adjust this value to fine-tune audio sync
    const adjustedStartTime = startTime + (TRIM_START_MS / 1000);

    // Calculate sample offsets with adjusted start time
    const startSample = Math.floor(adjustedStartTime * audioBuffer.sampleRate);
    const endSample = Math.ceil(endTime * audioBuffer.sampleRate);
    const length = endSample - startSample;

    // Create a new buffer for this word
    const wordBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      length,
      audioBuffer.sampleRate
    );

    // Copy the audio data for this time range
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const sourceData = audioBuffer.getChannelData(channel);
      const targetData = wordBuffer.getChannelData(channel);

      for (let i = 0; i < length; i++) {
        targetData[i] = sourceData[startSample + i];
      }
    }

    // Convert buffer to blob
    const wordBlob = await audioBufferToBlob(wordBuffer);
    const wordBlobUri = URL.createObjectURL(wordBlob);

    wordBlobs.push({
      word: timing.word,
      blobUri: wordBlobUri,
    });

    console.log(`Sliced word "${timing.word}": ${duration.toFixed(3)}s (${startTime.toFixed(3)}s - ${endTime.toFixed(3)}s)`);
  }

  console.log('Audio slicing complete:', wordBlobs.length, 'segments created');

  return wordBlobs;
}

/**
 * Convert AudioBuffer to WAV Blob
 * @param {AudioBuffer} audioBuffer - The audio buffer to convert
 * @returns {Promise<Blob>} WAV audio blob
 */
async function audioBufferToBlob(audioBuffer) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;

  // Interleave channels
  const interleaved = new Float32Array(length * numberOfChannels);

  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      interleaved[i * numberOfChannels + channel] = audioBuffer.getChannelData(channel)[i];
    }
  }

  // Convert to 16-bit PCM
  const pcm = new Int16Array(interleaved.length);
  for (let i = 0; i < interleaved.length; i++) {
    const s = Math.max(-1, Math.min(1, interleaved[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  // Create WAV file
  const wavBuffer = createWavFile(pcm, sampleRate, numberOfChannels);

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

/**
 * Create WAV file from PCM data
 */
function createWavFile(samples, sampleRate, numChannels) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');

  // FMT sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Sub-chunk size
  view.setUint16(20, 1, true); // Audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // Byte rate
  view.setUint16(32, numChannels * 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample

  // Data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    view.setInt16(offset, samples[i], true);
  }

  return buffer;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
