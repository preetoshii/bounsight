import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

/**
 * CalendarView - Vertical scrolling calendar with message slots
 */
export function CalendarView({ scheduledMessages, onSelectDate, onClose }) {
  // Generate date slots (past 7 days, today, next 30 days for now)
  const generateDateSlots = () => {
    const slots = [];
    const today = new Date();

    // Past 7 days (read-only)
    for (let i = 7; i > 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      slots.push({
        date: date.toISOString().split('T')[0],
        isPast: true,
        isToday: false,
      });
    }

    // Today (active)
    slots.push({
      date: today.toISOString().split('T')[0],
      isPast: false,
      isToday: true,
    });

    // Next 30 days
    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      slots.push({
        date: date.toISOString().split('T')[0],
        isPast: false,
        isToday: false,
      });
    }

    return slots;
  };

  const slots = generateDateSlots();

  const formatDate = (dateStr, isToday) => {
    const date = new Date(dateStr + 'T00:00:00'); // Parse as local time
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
    const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    if (isToday) {
      return `TODAY, ${monthDay}`;
    }
    return `${weekday}, ${monthDay}`;
  };

  const getMessageForDate = (dateStr) => {
    return scheduledMessages[dateStr] || null;
  };

  return (
    <View style={styles.container}>
      {/* Header with close button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Scrolling calendar */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {slots.map((slot) => {
          const message = getMessageForDate(slot.date);
          const isEditable = !slot.isPast;

          return (
            <TouchableOpacity
              key={slot.date}
              style={[
                styles.slot,
                slot.isPast && styles.slotPast,
                slot.isToday && styles.slotToday,
              ]}
              onPress={() => isEditable && onSelectDate(slot.date, message?.text || '')}
              disabled={slot.isPast}
            >
              <View style={styles.slotHeader}>
                <Text style={[styles.slotDate, slot.isPast && styles.textMuted]}>
                  {formatDate(slot.date, slot.isToday)}
                </Text>
                {slot.isToday && <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>ACTIVE</Text></View>}
              </View>

              <Text style={[styles.slotMessage, slot.isPast && styles.textMuted]}>
                {message?.text ? message.text.substring(0, 60) + (message.text.length > 60 ? '...' : '') : 'Empty'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
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
    padding: 20,
    paddingTop: 60, // Safe area
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '300',
    color: '#ffffff',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  slot: {
    backgroundColor: '#111',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222',
    padding: 16,
    marginBottom: 12,
  },
  slotPast: {
    opacity: 0.5,
  },
  slotToday: {
    borderColor: '#4a9eff',
    borderWidth: 2,
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  slotDate: {
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
  slotMessage: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },
  textMuted: {
    color: '#666',
  },
});
