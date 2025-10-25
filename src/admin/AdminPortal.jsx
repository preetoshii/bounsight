import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { CalendarView } from './CalendarView';
import { EditView } from './EditView';
import { Confirmation } from './Confirmation';

/**
 * AdminPortal - Root component for admin interface
 * Manages view state and fade transitions between views
 */
export function AdminPortal({ onClose, onShowPreview }) {
  const [currentView, setCurrentView] = useState('calendar'); // 'calendar' | 'edit' | 'confirmation'
  const [editingDate, setEditingDate] = useState(null); // Date being edited
  const [draftMessage, setDraftMessage] = useState(''); // Message being composed
  const [scheduledMessages, setScheduledMessages] = useState({}); // All scheduled messages

  // Navigate to edit view for a specific date
  const openEditView = (date, existingMessage = '') => {
    setEditingDate(date);
    setDraftMessage(existingMessage);
    setCurrentView('edit');
  };

  // Navigate to preview mode (uses main game with preview overlay)
  const openPreview = () => {
    onShowPreview({
      message: draftMessage,
      isActive: isEditingToday(),
      onBack: () => {
        onShowPreview(null); // Exit preview mode
        // Stay in edit view
      },
      onSave: isEditingToday() ? sendNow : saveMessage,
    });
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
          onSelectDate={openEditView}
          onClose={onClose}
        />
      )}

      {currentView === 'edit' && (
        <EditView
          date={editingDate}
          message={draftMessage}
          isActive={isEditingToday()}
          onMessageChange={setDraftMessage}
          onBack={backToCalendar}
          onPreview={openPreview}
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
