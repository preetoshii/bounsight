import React, { useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { CalendarView } from './CalendarView';
import { PreviewMode } from './PreviewMode';
import { Confirmation } from './Confirmation';

/**
 * AdminPortal - Root component for admin interface
 * Manages view state and fade transitions between views
 */
export function AdminPortal({ onClose }) {
  const [currentView, setCurrentView] = useState('calendar'); // 'calendar' | 'preview' | 'confirmation'
  const [editingDate, setEditingDate] = useState(null); // Date being edited
  const [draftMessage, setDraftMessage] = useState(''); // Message being composed
  const [scheduledMessages, setScheduledMessages] = useState({}); // All scheduled messages

  // Animated values for view transitions
  const calendarOpacity = React.useRef(new Animated.Value(1)).current;
  const previewOpacity = React.useRef(new Animated.Value(0)).current;

  // Navigate to preview mode directly from calendar
  const openPreview = (date, message) => {
    setEditingDate(date);
    setDraftMessage(message);

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

  // Navigate back to calendar (keep editing state)
  const backToCalendar = () => {
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

  // Save message (for future dates)
  const saveMessage = () => {
    // TODO: Update scheduled-messages.json via GitHub API
    console.log('Saving message for', editingDate, ':', draftMessage);
    backToCalendar();
  };

  // Send now (for active message)
  const sendNow = () => {
    setCurrentView('confirmation');
  };

  // Confirm send now
  const confirmSendNow = () => {
    // TODO: Update current-message.json via GitHub API
    console.log('Sending message now:', draftMessage);
    backToCalendar();
  };

  // Check if editing today's message
  const isEditingToday = () => {
    if (!editingDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return editingDate === today;
  };

  return (
    <View style={styles.container}>
      {/* Calendar View - always rendered for smooth transitions */}
      <Animated.View style={[styles.fullScreen, { opacity: calendarOpacity, pointerEvents: currentView === 'calendar' ? 'auto' : 'none' }]}>
        <CalendarView
          scheduledMessages={scheduledMessages}
          onSelectDate={openPreview}
          onClose={onClose}
          initialEditingDate={editingDate}
          initialEditingText={draftMessage}
        />
      </Animated.View>

      {/* Preview Mode - always rendered for smooth transitions */}
      <Animated.View style={[styles.fullScreen, { opacity: previewOpacity, pointerEvents: currentView === 'preview' ? 'auto' : 'none' }]}>
        <PreviewMode
          message={draftMessage}
          isActive={isEditingToday()}
          onBack={backToCalendar}
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
});
