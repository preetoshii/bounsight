import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withSpring, Easing } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, useAudioPlayer } from 'expo-audio';
import { startRecording, stopRecording, formatDuration } from '../services/audioRecordingService';
import { getWordTimestamps } from '../services/wordTimestampsService';

/**
 * AudioRecorder Component
 *
 * Single morphing button that transforms Record → Stop → Review
 * Button pulses smoothly with Reanimated during recording
 * Duration timer displayed inside the button
 * Sentence Break button (✂️) appears to the left while recording
 *
 * States:
 * - Idle: Shows red "🎤 Record" button
 * - Recording: Main button (gray "⏹ Stop") + Sentence Break button (left)
 * - Review: Redo button (left) + Complete button (right)
 */
export function AudioRecorder({ onRecordingComplete }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);

  // Track sentence break timestamps and recording state
  const [sentenceBreaks, setSentenceBreaks] = useState([]);
  const [recordedUri, setRecordedUri] = useState(null);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Audio player for playback
  const player = useAudioPlayer(recordedUri || '');

  // Reanimated shared values for smooth 60fps animations
  const scale = useSharedValue(1);
  const backgroundColor = useSharedValue(0); // 0 = red, 1 = gray
  const breakButtonOpacity = useSharedValue(0); // Sentence break button fade in/out

  // Pulse animation when recording
  useEffect(() => {
    if (state.isRecording) {
      // Smooth continuous pulse using Reanimated
      scale.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // Infinite loop
        false
      );
      // Morph to gray
      backgroundColor.value = withSpring(1, { damping: 20, stiffness: 300 });
      // Show sentence break button
      breakButtonOpacity.value = withSpring(1, { damping: 20, stiffness: 300 });
    } else {
      // Stop pulsing and reset
      scale.value = withSpring(1, { damping: 20, stiffness: 400 });
      // Morph back to red
      backgroundColor.value = withSpring(0, { damping: 20, stiffness: 300 });
      // Hide sentence break button
      breakButtonOpacity.value = withSpring(0, { damping: 20, stiffness: 300 });
      // Reset sentence breaks when not recording
      setSentenceBreaks([]);
    }
  }, [state.isRecording]);

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
      console.log('Sentence breaks at:', sentenceBreaks);

      // Enter review mode instead of immediately notifying parent
      setRecordedUri(uri);
      setIsReviewMode(true);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert('Could not stop recording.');
    }
  };

  const handleRedo = () => {
    // Discard recording and reset to idle
    console.log('Redo: discarding recording');
    setRecordedUri(null);
    setIsReviewMode(false);
    setSentenceBreaks([]);
  };

  const handleComplete = async () => {
    // Start transcription process
    console.log('Complete: starting transcription...');
    setIsTranscribing(true);

    try {
      // Call word-timestamps API for precise word boundaries
      const result = await getWordTimestamps(recordedUri, sentenceBreaks);

      console.log('Word timestamps retrieved successfully!');
      console.log('Result:', result);

      // Notify parent with transcription result
      if (onRecordingComplete && recordedUri) {
        onRecordingComplete(recordedUri, sentenceBreaks, result);
      }
    } catch (error) {
      console.error('Transcription failed:', error);
      alert(`Transcription error: ${error.message}\n\nPlease try recording again.`);
      // Reset to review mode on error
      setIsTranscribing(false);
    }
  };

  const handlePlayAudio = () => {
    if (player && recordedUri) {
      console.log('Playing audio:', recordedUri);
      player.play();
    }
  };

  const handleSentenceBreak = () => {
    // Record current timestamp
    const timestamp = state.durationMillis;
    setSentenceBreaks(prev => [...prev, timestamp]);
    console.log(`Sentence break marked at ${timestamp}ms`);
  };

  const handleButtonPress = () => {
    if (state.isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  // Animated styles with color interpolation
  const animatedStyle = useAnimatedStyle(() => {
    const bgColor = backgroundColor.value === 0
      ? 'rgb(229, 62, 62)' // Red (#e53e3e)
      : 'rgb(102, 102, 102)'; // Gray (#666)

    return {
      transform: [{ scale: scale.value }],
      backgroundColor: bgColor,
    };
  });

  // Animated style for sentence break button
  const breakButtonStyle = useAnimatedStyle(() => ({
    opacity: breakButtonOpacity.value,
    transform: [
      { scale: breakButtonOpacity.value }, // Scale from 0 to 1
      { translateX: breakButtonOpacity.value === 0 ? 20 : 0 } // Slide in from right
    ],
  }));

  return (
    <View style={styles.container}>
      {isTranscribing ? (
        // Transcribing state: Show loading spinner
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a9eff" />
          <Text style={styles.loadingText}>Transcribing...</Text>
        </View>
      ) : isReviewMode ? (
        // Review mode: Redo (left) + Play (center) + Complete (right)
        <View style={styles.reviewButtonsRow}>
          <TouchableOpacity
            style={[styles.reviewButton, styles.redoButton]}
            onPress={handleRedo}
            activeOpacity={0.7}
          >
            <Feather name="rotate-ccw" size={20} color="#fff" />
            <Text style={styles.reviewButtonText}>Redo</Text>
          </TouchableOpacity>

          {/* Center Play button */}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#4a9eff' }]}
            onPress={handlePlayAudio}
            activeOpacity={0.8}
          >
            <Feather name="play" size={32} color="#fff" style={styles.icon} />
            <Text style={styles.buttonText}>Play</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.reviewButton, styles.completeButton]}
            onPress={handleComplete}
            activeOpacity={0.7}
          >
            <Feather name="check" size={20} color="#fff" />
            <Text style={styles.reviewButtonText}>Complete</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Recording/Idle mode
        <View style={styles.recordingContainer}>
          {/* Sentence Break button (left) - positioned absolutely */}
          <Animated.View style={[styles.breakButtonContainer, breakButtonStyle]} pointerEvents={state.isRecording ? 'auto' : 'none'}>
            <TouchableOpacity
              style={styles.breakButton}
              onPress={handleSentenceBreak}
              activeOpacity={0.7}
            >
              <Text style={styles.breakButtonIcon}>*</Text>
              <Text style={styles.breakButtonText}>Break</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Main morphing button with timer inside */}
          <Animated.View style={[styles.button, animatedStyle]}>
            <TouchableOpacity
              style={styles.buttonTouchable}
              onPress={handleButtonPress}
              activeOpacity={0.8}
            >
              {state.isRecording ? (
                // Recording state: Show timer and Stop icon
                <>
                  <View style={styles.timerRow}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.timerText}>
                      {formatDuration(state.durationMillis)}
                    </Text>
                  </View>
                  <Feather name="square" size={28} color="#fff" style={styles.icon} />
                  <Text style={styles.buttonText}>Stop</Text>
                </>
              ) : (
                // Idle state: Show Record icon
                <>
                  <Feather name="mic" size={32} color="#fff" style={styles.icon} />
                  <Text style={styles.buttonText}>Record</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
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

  // Recording container - allows absolute positioning
  recordingContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sentence Break button container - positioned absolutely to the left
  breakButtonContainer: {
    position: 'absolute',
    left: -130, // Position to the left of the main button (100px width + 30px gap)
  },
  breakButton: {
    backgroundColor: '#444',
    borderRadius: 60,
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  breakButtonIcon: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '600',
  },
  breakButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },

  // Morphing button container (main button)
  button: {
    borderRadius: 100,
    width: 180,
    height: 180,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },

  // Touchable area (fills the animated button)
  buttonTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Timer inside button (when recording)
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  timerText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Courier', // Monospace for stable width
  },

  // Icon spacing
  icon: {
    marginBottom: 4,
  },

  // Button label
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },

  // Review mode buttons
  reviewButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  reviewButton: {
    borderRadius: 50,
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  redoButton: {
    backgroundColor: '#666',
    shadowColor: '#666',
  },
  completeButton: {
    backgroundColor: '#38a169', // Green
    shadowColor: '#38a169',
  },
  reviewButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },

  // Loading state
  loadingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
  },
});
