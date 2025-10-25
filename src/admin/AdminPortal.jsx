import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CalendarView } from './CalendarView';
import { PreviewMode } from './PreviewMode';
import { Confirmation } from './Confirmation';
import { fetchMessages, saveMessage as saveMessageToGitHub } from './githubApi';
import { playSound } from '../utils/audio';

/**
 * AdminPortal - Root component for admin interface
 * Manages view state and fade transitions between views
 */
export function AdminPortal({ onClose }) {
  const [currentView, setCurrentView] = useState('calendar'); // 'calendar' | 'preview' | 'confirmation'
  const [editingDate, setEditingDate] = useState(null); // Date being edited (when set, card is in edit mode)
  const [draftMessage, setDraftMessage] = useState(''); // Message being composed
  const [scheduledMessages, setScheduledMessages] = useState({}); // All scheduled messages
  const [scrollToDate, setScrollToDate] = useState(null); // Date to scroll to when returning to calendar
  const [messagesData, setMessagesData] = useState(null); // Full messages.json data (includes _sha for updates)
  const [isLoading, setIsLoading] = useState(true); // Loading state

  // Animated values for view transitions
  const calendarOpacity = React.useRef(new Animated.Value(1)).current;
  const previewOpacity = React.useRef(new Animated.Value(0)).current;

  // Load messages on mount
  useEffect(() => {
    loadMessages();
  }, []);

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
  const openPreview = () => {
    // Fade out calendar first, then fade in preview
    Animated.timing(calendarOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setCurrentView('preview');
      Animated.timing(previewOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  // Navigate back from preview to calendar (with edit state preserved)
  const backFromPreview = () => {
    // Fade out preview first, then fade in calendar
    Animated.timing(previewOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setCurrentView('calendar');
      Animated.timing(calendarOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
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
    playSound('click');
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
      <TouchableOpacity
        onPress={handleBack}
        style={styles.backButton}
      >
        <Feather name="arrow-left" size={28} color="#ffffff" />
      </TouchableOpacity>
      {/* Calendar View - always rendered for smooth transitions */}
      <Animated.View style={[styles.fullScreen, { opacity: calendarOpacity, pointerEvents: currentView === 'calendar' ? 'auto' : 'none' }]}>
        <CalendarView
          scheduledMessages={scheduledMessages}
          onSelectDate={openEdit}
          onPreview={openPreview}
          initialEditingDate={editingDate}
          initialEditingText={draftMessage}
          scrollToDate={scrollToDate}
          onScrollComplete={() => setScrollToDate(null)}
        />
      </Animated.View>

      {/* Preview Mode - always rendered for smooth transitions */}
      <Animated.View style={[styles.fullScreen, { opacity: previewOpacity, pointerEvents: currentView === 'preview' ? 'auto' : 'none' }]}>
        <PreviewMode
          message={draftMessage}
          isActive={isEditingToday()}
          onSave={isEditingToday() ? sendNow : saveMessage}
        />
      </Animated.View>

      {currentView === 'confirmation' && (
        <Confirmation
          onCancel={() => setCurrentView('preview')}
          onConfirm={confirmSendNow}
        />
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
});
