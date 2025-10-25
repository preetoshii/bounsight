import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';

/**
 * EditView - Focused message composition interface
 */
export function EditView({ date, message, isActive, onMessageChange, onBack, onPreview }) {
  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00'); // Parse as local time
    const today = new Date().toISOString().split('T')[0];
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
    const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    if (dateStr === today) {
      return `TODAY, ${monthDay}`;
    }
    return `${weekday}, ${monthDay}`;
  };

  const isPreviewDisabled = !message || message.trim().length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header with back button and date */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.dateText}>{formatDate(date)}</Text>
          {isActive && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>ACTIVE</Text>
            </View>
          )}
        </View>

        {/* Empty space for balance */}
        <View style={styles.backButton} />
      </View>

      {/* Message input area */}
      <View style={styles.content}>
        <TextInput
          style={styles.textArea}
          value={message}
          onChangeText={onMessageChange}
          placeholder="Enter your message..."
          placeholderTextColor="#666"
          multiline
          autoFocus
          textAlignVertical="top"
        />
      </View>

      {/* Preview button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.previewButton, isPreviewDisabled && styles.previewButtonDisabled]}
          onPress={onPreview}
          disabled={isPreviewDisabled}
        >
          <Text style={[styles.previewButtonText, isPreviewDisabled && styles.previewButtonTextDisabled]}>
            Preview
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60, // Safe area
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: '300',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#ffffff',
  },
  activeBadge: {
    backgroundColor: '#4a9eff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  textArea: {
    flex: 1,
    fontSize: 18,
    lineHeight: 28,
    color: '#ffffff',
    fontWeight: '300',
  },
  footer: {
    padding: 24,
    paddingBottom: 40, // Extra padding for safe area
  },
  previewButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  previewButtonDisabled: {
    backgroundColor: '#333',
  },
  previewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a0a0a',
  },
  previewButtonTextDisabled: {
    color: '#666',
  },
});
