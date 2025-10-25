import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CalendarView } from './CalendarView';
import { PreviewMode } from './PreviewMode';
import { Confirmation } from './Confirmation';
import { fetchMessages, saveMessage as saveMessageToGitHub } from './githubApi';
import { playSound } from '../utils/audio';
import { generateAudioForMessage } from '../services/wordAudioService';
import { Button } from '../components/Button';

/**
 * AdminPortal - Root component for admin interface
 * Manages view state and transitions between calendar, preview, and confirmation views
 */
export function AdminPortal({ onClose, preloadedData }) {
  const [currentView, setCurrentView] = useState('calendar'); // 'calendar' | 'preview' | 'confirmation'
  const [editingDate, setEditingDate] = useState(null); // Date being edited (when set, card is in edit mode)
  const [draftMessage, setDraftMessage] = useState(''); // Message being composed
  const [scheduledMessages, setScheduledMessages] = useState({}); // All scheduled messages
  const [scrollToDate, setScrollToDate] = useState(null); // Date to scroll to when returning to calendar
  const [messagesData, setMessagesData] = useState(null); // Full messages.json data (includes _sha for updates)
  const [isLoading, setIsLoading] = useState(!preloadedData); // Loading state (false if data was preloaded)
  const [audioGenerationStatus, setAudioGenerationStatus] = useState(null); // {status: 'generating'|'complete'|'error', progress: {current, total}, message}

  // Load messages on mount (or use preloaded data)
  useEffect(() => {
    if (preloadedData) {
      // Use preloaded data to avoid flicker
      setMessagesData(preloadedData);
      setScheduledMessages(preloadedData.messages || {});
      console.log('Using preloaded messages:', preloadedData);
    } else {
      // Fallback: load from GitHub
      loadMessages();
    }
  }, [preloadedData]);

  // Load all messages from GitHub
  const loadMessages = async () => {
    try {
      setIsLoading(true);
      const data = await fetchMessages();
      setMessagesData(data);
      setScheduledMessages(data.messages || {});
      console.log('Loaded messages from GitHub:', data);
    } catch (error) {
      console.error('Failed to load messages:', error);
      // Use empty messages as fallback
      setScheduledMessages({});
    } finally {
      setIsLoading(false);
    }
  };

  // When clicking a card, just set editing state (card expands in place)
  const openEdit = (date, message) => {
    setEditingDate(date);
    setDraftMessage(message);
  };

  // Navigate to preview mode from edit mode
  const openPreview = async () => {
    // Show generating status
    setAudioGenerationStatus({
      status: 'generating',
      message: 'Checking for new words...',
    });

    try {
      // Generate audio for any new words in the message
      const result = await generateAudioForMessage(
        draftMessage,
        (word, current, total) => {
          setAudioGenerationStatus({
            status: 'generating',
            progress: { current, total },
            message: `Generating audio for "${word}" (${current}/${total})...`,
          });
        }
      );

      const { generated, existing, failed } = result;

      if (failed.length > 0) {
        console.warn('Some words failed to generate audio:', failed);
        setAudioGenerationStatus({
          status: 'error',
          message: `Failed to generate audio for: ${failed.join(', ')}`,
        });
        // Still show preview, but with warning
        setTimeout(() => setAudioGenerationStatus(null), 3000);
      } else if (generated.length > 0) {
        console.log(`✓ Generated audio for ${generated.length} new word(s):`, generated);
        setAudioGenerationStatus({
          status: 'complete',
          message: `Generated audio for ${generated.length} new word(s)!`,
        });
        setTimeout(() => setAudioGenerationStatus(null), 2000);
      } else {
        console.log('✓ All words already have audio');
        setAudioGenerationStatus(null);
      }
    } catch (error) {
      console.error('Audio generation failed:', error);
      setAudioGenerationStatus({
        status: 'error',
        message: 'Failed to generate audio. Preview will show text only.',
      });
      setTimeout(() => setAudioGenerationStatus(null), 3000);
    }

    // Navigate to preview
    setCurrentView('preview');
  };

  // Navigate back from preview to calendar (with edit state preserved)
  const backFromPreview = () => {
    setCurrentView('calendar');
  };

  // Exit edit mode (collapse card)
  const exitEdit = () => {
    setEditingDate(null);
    setDraftMessage('');
  };

  // Save message (for future dates)
  const saveMessage = async () => {
    // Validation: Check for empty or invalid data
    if (!editingDate || editingDate === 'null') {
      console.error('Cannot save: invalid date', editingDate);
      alert('Error: Invalid date. Please try again.');
      return;
    }

    if (!draftMessage || draftMessage.trim().length === 0) {
      console.error('Cannot save: empty message');
      alert('Error: Message cannot be empty.');
      return;
    }

    try {
      const savedDate = editingDate;
      const savedMessage = draftMessage;

      // Save to GitHub (makeCurrent = false for future dates)
      const updatedData = await saveMessageToGitHub(savedDate, savedMessage, false);

      // Update local state
      setMessagesData(updatedData);
      setScheduledMessages(updatedData.messages || {});

      console.log('Saved message for', savedDate);

      // Clear editing state AFTER successful save so we return to normal calendar view (not edit mode)
      setScrollToDate(savedDate); // Remember which card to scroll to
      setEditingDate(null);
      setDraftMessage('');

      // Fade back to calendar
      backFromPreview();
    } catch (error) {
      console.error('Failed to save message:', error);
      // TODO: Show error to user
      alert('Failed to save message. Please try again.');
      return; // Don't navigate away on error
    }
  };

  // Send now (for active message)
  const sendNow = () => {
    setCurrentView('confirmation');
  };

  // Confirm send now
  const confirmSendNow = async () => {
    // Validation: Check for empty or invalid data
    if (!editingDate || editingDate === 'null') {
      console.error('Cannot send: invalid date', editingDate);
      alert('Error: Invalid date. Please try again.');
      setCurrentView('preview'); // Go back to preview
      return;
    }

    if (!draftMessage || draftMessage.trim().length === 0) {
      console.error('Cannot send: empty message');
      alert('Error: Message cannot be empty.');
      setCurrentView('preview'); // Go back to preview
      return;
    }

    try {
      const savedDate = editingDate;
      const savedMessage = draftMessage;

      // Save to GitHub with makeCurrent = true (updates both message and current pointer)
      const updatedData = await saveMessageToGitHub(savedDate, savedMessage, true);

      // Update local state
      setMessagesData(updatedData);
      setScheduledMessages(updatedData.messages || {});

      console.log('Sent message now for', savedDate);

      // Clear editing state AFTER successful save
      setScrollToDate(savedDate); // Remember which card to scroll to
      setEditingDate(null);
      setDraftMessage('');

      // Close admin portal and return to game
      onClose();
    } catch (error) {
      console.error('Failed to send message:', error);
      // TODO: Show error to user
      alert('Failed to send message. Please try again.');
      return; // Don't navigate away on error
    }
  };

  // Check if editing today's message
  const isEditingToday = () => {
    if (!editingDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return editingDate === today;
  };

  // Handle back button - simple and direct
  const handleBack = () => {
    playSound('back-button');
    console.log('🔙 Back pressed. currentView:', currentView, 'editingDate:', editingDate);

    if (currentView === 'confirmation') {
      console.log('→ Going to preview');
      setCurrentView('preview');
    } else if (currentView === 'preview') {
      console.log('→ Going back to calendar from preview');
      backFromPreview();
    } else if (currentView === 'calendar' && editingDate) {
      console.log('→ Collapsing card');
      exitEdit();
    } else if (currentView === 'calendar') {
      console.log('→ Closing portal');
      playSound('card-slide');
      onClose();
    }
  };

  return (
    <View style={styles.container}>
      {/* Single persistent back button */}
      <Button
        onPress={handleBack}
        style={styles.backButton}
      >
        <Feather name="arrow-left" size={28} color="#ffffff" />
      </Button>
      {/* Calendar View - only render when active */}
      {currentView === 'calendar' && (
        <CalendarView
          scheduledMessages={scheduledMessages}
          onSelectDate={openEdit}
          onPreview={openPreview}
          initialEditingDate={editingDate}
          initialEditingText={draftMessage}
          scrollToDate={scrollToDate}
          onScrollComplete={() => setScrollToDate(null)}
        />
      )}

      {/* Preview Mode - only render when active */}
      {currentView === 'preview' && (
        <PreviewMode
          message={draftMessage}
          isActive={isEditingToday()}
          onSave={isEditingToday() ? sendNow : saveMessage}
        />
      )}

      {currentView === 'confirmation' && (
        <Confirmation
          onCancel={() => setCurrentView('preview')}
          onConfirm={confirmSendNow}
        />
      )}

      {/* Audio generation status overlay */}
      {audioGenerationStatus && (
        <View style={styles.audioStatusOverlay}>
          <View style={[
            styles.audioStatusBox,
            audioGenerationStatus.status === 'error' && styles.audioStatusError,
            audioGenerationStatus.status === 'complete' && styles.audioStatusComplete,
          ]}>
            <Text style={styles.audioStatusText}>
              {audioGenerationStatus.message}
            </Text>
            {audioGenerationStatus.progress && (
              <Text style={styles.audioStatusProgress}>
                {audioGenerationStatus.progress.current} / {audioGenerationStatus.progress.total}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backButton: {
    position: 'absolute',
    top: 30,
    left: 30,
    padding: 24,
    zIndex: 9999,
  },
  audioStatusOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 10000,
  },
  audioStatusBox: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    minWidth: 300,
    maxWidth: 500,
    alignItems: 'center',
  },
  audioStatusError: {
    borderColor: '#ff4444',
  },
  audioStatusComplete: {
    borderColor: '#44ff44',
  },
  audioStatusText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  audioStatusProgress: {
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
  },
});
