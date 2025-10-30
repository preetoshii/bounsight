/**
 * Audio Recording Service
 *
 * Simple wrapper around expo-audio for recording voice messages.
 * Provides easy-to-use functions for starting, stopping, and managing recordings.
 *
 * Usage:
 *   const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
 *   const state = useAudioRecorderState(recorder);
 *   await startRecording(recorder);
 *   await stopRecording(recorder);
 *   const uri = recorder.uri; // Get recorded file
 */

import { RecordingPresets } from 'expo-audio';

/**
 * Start recording audio
 * @param {AudioRecorder} recorder - The recorder instance from useAudioRecorder hook
 */
export async function startRecording(recorder) {
  try {
    console.log('Preparing to record...');
    await recorder.prepareToRecordAsync();
    console.log('Recording started');
    recorder.record();
    return true;
  } catch (error) {
    console.error('Failed to start recording:', error);
    throw error;
  }
}

/**
 * Stop recording audio
 * @param {AudioRecorder} recorder - The recorder instance from useAudioRecorder hook
 * @returns {string} URI of the recorded audio file
 */
export async function stopRecording(recorder) {
  try {
    console.log('Stopping recording...');
    await recorder.stop();
    const uri = recorder.uri;
    console.log('Recording stopped. File saved at:', uri);
    return uri;
  } catch (error) {
    console.error('Failed to stop recording:', error);
    throw error;
  }
}

/**
 * Format duration in milliseconds to MM:SS
 * @param {number} durationMillis - Duration in milliseconds
 * @returns {string} Formatted time string (MM:SS)
 */
export function formatDuration(durationMillis) {
  if (!durationMillis || durationMillis < 0) return '00:00';

  const totalSeconds = Math.floor(durationMillis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get high-quality recording preset
 * Use this when creating a recorder with useAudioRecorder hook
 */
export { RecordingPresets };
