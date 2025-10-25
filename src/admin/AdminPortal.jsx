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

  // Navigate to preview mode directly from calendar
  const openPreview = (date, message) => {
    setEditingDate(date);
    setDraftMessage(message);
    setCurrentView('preview');
  };

  // Navigate back to calendar
  const backToCalendar = () => {
    setCurrentView('calendar');
    setEditingDate(null);
    setDraftMessage('');
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
      {currentView === 'calendar' && (
        <CalendarView
          scheduledMessages={scheduledMessages}
          onSelectDate={openPreview}
          onClose={onClose}
        />
      )}

      {currentView === 'preview' && (
        <PreviewMode
          message={draftMessage}
          isActive={isEditingToday()}
          onBack={backToCalendar}
          onSave={isEditingToday() ? sendNow : saveMessage}
        />
      )}

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
});
