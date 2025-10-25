import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CalendarView } from './CalendarView';
import { PreviewMode } from './PreviewMode';
import { Confirmation } from './Confirmation';
import { fetchMessages, saveMessage as saveMessageToGitHub } from './githubApi';

/**
 * AdminPortal - Root component for admin interface
 * Manages view state and fade transitions between views
 */
export function AdminPortal({ onClose }) {
  const [currentView, setCurrentView] = useState('calendar'); // 'calendar' | 'edit' | 'preview' | 'confirmation'
  const [editingDate, setEditingDate] = useState(null); // Date being edited
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

  // Navigate to edit mode when clicking a card (just sets state, no fade needed)
  const openEdit = (date, message) => {
    setEditingDate(date);
    setDraftMessage(message);
    setCurrentView('edit');
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

  // Navigate back from preview to edit
  const backToEdit = () => {
    // Fade out preview first, then fade in calendar (with edit state)
    Animated.timing(previewOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setCurrentView('edit');
      Animated.timing(calendarOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  // Navigate back from edit to calendar
  const backToCalendar = () => {
    setCurrentView('calendar');
    setEditingDate(null);
    setDraftMessage('');
  };

  // Save message (for future dates)
  const saveMessage = async () => {
    try {
      const savedDate = editingDate;

      // Save to GitHub (makeCurrent = false for future dates)
      const updatedData = await saveMessageToGitHub(savedDate, draftMessage, false);

      // Update local state
      setMessagesData(updatedData);
      setScheduledMessages(updatedData.messages || {});

      // Clear editing state so we return to normal calendar view (not edit mode)
      setScrollToDate(savedDate); // Remember which card to scroll to
      setEditingDate(null);
      setDraftMessage('');

      console.log('Saved message for', savedDate);
    } catch (error) {
      console.error('Failed to save message:', error);
      // TODO: Show error to user
      alert('Failed to save message. Please try again.');
      return; // Don't navigate away on error
    }

    // Fade back to calendar
    backToCalendar();
  };

  // Send now (for active message)
  const sendNow = () => {
    setCurrentView('confirmation');
  };

  // Confirm send now
  const confirmSendNow = async () => {
    try {
      const savedDate = editingDate;

      // Save to GitHub with makeCurrent = true (updates both message and current pointer)
      const updatedData = await saveMessageToGitHub(savedDate, draftMessage, true);

      // Update local state
      setMessagesData(updatedData);
      setScheduledMessages(updatedData.messages || {});

      // Clear editing state
      setScrollToDate(savedDate); // Remember which card to scroll to
      setEditingDate(null);
      setDraftMessage('');

      console.log('Sent message now for', savedDate);
    } catch (error) {
      console.error('Failed to send message:', error);
      // TODO: Show error to user
      alert('Failed to send message. Please try again.');
      return; // Don't navigate away on error
    }

    // Fade back to calendar
    backToCalendar();
  };

  // Check if editing today's message
  const isEditingToday = () => {
    if (!editingDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return editingDate === today;
  };

  // Handle back button based on current view
  const handleBack = () => {
    if (currentView === 'confirmation') {
      // Confirmation → Preview
      setCurrentView('preview');
    } else if (currentView === 'preview') {
      // Preview → Edit
      backToEdit();
    } else if (currentView === 'edit') {
      // Edit → Calendar
      backToCalendar();
    } else if (currentView === 'calendar') {
      // Calendar → Game (close portal)
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
      <Animated.View style={[styles.fullScreen, { opacity: calendarOpacity, pointerEvents: (currentView === 'calendar' || currentView === 'edit') ? 'auto' : 'none' }]}>
        <CalendarView
          scheduledMessages={scheduledMessages}
          onSelectDate={openEdit}
          onPreview={openPreview}
          initialEditingDate={editingDate}
          initialEditingText={draftMessage}
          scrollToDate={scrollToDate}
          onScrollComplete={() => setScrollToDate(null)}
          isEditMode={currentView === 'edit'}
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
