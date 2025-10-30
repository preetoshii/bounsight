import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets } from 'expo-audio';
import { startRecording, stopRecording, formatDuration } from '../services/audioRecordingService';

/**
 * AudioRecorder Component
 *
 * Simple audio recording UI for admin mode.
 * Shows a big Record button, recording duration, and Stop button.
 *
 * States:
 * - Idle: Shows "🎤 Record" button
 * - Recording: Shows duration timer and "⏹ Stop" button
 */
export function AudioRecorder({ onRecordingComplete }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);

  const handleStartRecording = async () => {
    try {
      await startRecording(recorder);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Could not start recording. Please check microphone permissions.');
    }
  };

  const handleStopRecording = async () => {
    try {
      const uri = await stopRecording(recorder);
      console.log('Recording saved at:', uri);

      // Notify parent component
      if (onRecordingComplete) {
        onRecordingComplete(uri);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert('Could not stop recording.');
    }
  };

  return (
    <View style={styles.container}>
      {!state.isRecording ? (
        // Idle state: Show Record button
        <TouchableOpacity
          style={styles.recordButton}
          onPress={handleStartRecording}
        >
          <Feather name="mic" size={32} color="#fff" />
          <Text style={styles.recordButtonText}>Record</Text>
        </TouchableOpacity>
      ) : (
        // Recording state: Show duration and Stop button
        <View style={styles.recordingContainer}>
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.durationText}>
              {formatDuration(state.durationMillis)}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.stopButton}
            onPress={handleStopRecording}
          >
            <Feather name="square" size={24} color="#fff" />
            <Text style={styles.stopButtonText}>Stop</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // Record button (idle state)
  recordButton: {
    backgroundColor: '#e53e3e', // Red
    borderRadius: 100,
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#e53e3e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },

  // Recording state
  recordingContainer: {
    alignItems: 'center',
    gap: 32,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e53e3e',
    // Pulsing animation would be nice, but keeping it simple for now
  },
  durationText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '600',
    fontFamily: 'Courier', // Monospace for stable width
  },

  // Stop button
  stopButton: {
    backgroundColor: '#666',
    borderRadius: 80,
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 6,
  },
});
