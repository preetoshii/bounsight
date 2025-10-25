import React, { useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';

/**
 * CalendarView - Horizontal scrolling card-based calendar
 */
export function CalendarView({ scheduledMessages, onSelectDate, onClose }) {
  const { width, height } = Dimensions.get('window');
  const scrollViewRef = useRef(null);

  // Generate date slots (past 7 days, today, next 30 days)
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
    const date = new Date(dateStr + 'T00:00:00');
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

  // Card dimensions
  const cardWidth = width * 0.85; // 85% of screen width
  const cardHeight = height * 0.7; // 70% of screen height
  const cardSpacing = 16;

  return (
    <View style={styles.container}>
      {/* Header with close button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal scrolling cards */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + cardSpacing}
        decelerationRate="fast"
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: (width - cardWidth) / 2 }]}
      >
        {slots.map((slot, index) => {
          const message = getMessageForDate(slot.date);
          const isEditable = !slot.isPast;

          return (
            <TouchableOpacity
              key={slot.date}
              style={[
                styles.card,
                { width: cardWidth, height: cardHeight },
                slot.isPast && styles.cardPast,
                slot.isToday && styles.cardToday,
              ]}
              onPress={() => isEditable && onSelectDate(slot.date, message?.text || '')}
              disabled={slot.isPast}
              activeOpacity={0.9}
            >
              {/* Date header */}
              <View style={styles.cardHeader}>
                <Text style={[styles.cardDate, slot.isPast && styles.textMuted]}>
                  {formatDate(slot.date, slot.isToday)}
                </Text>
                {slot.isToday && (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>ACTIVE</Text>
                  </View>
                )}
              </View>

              {/* Message preview */}
              <View style={styles.cardContent}>
                {message?.text ? (
                  <Text style={[styles.messageText, slot.isPast && styles.textMuted]}>
                    {message.text}
                  </Text>
                ) : (
                  <Text style={styles.emptyText}>
                    {slot.isPast ? 'No message' : 'Tap to add message'}
                  </Text>
                )}
              </View>

              {/* Edit indicator for future dates */}
              {!slot.isPast && (
                <View style={styles.cardFooter}>
                  <Text style={styles.editHint}>Tap to edit</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Scroll hint */}
      <View style={styles.scrollHint}>
        <Text style={styles.scrollHintText}>← Swipe to browse →</Text>
      </View>
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
    paddingTop: 60,
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
  scrollContent: {
    paddingVertical: 40,
    gap: 16,
  },
  card: {
    backgroundColor: '#111',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
    padding: 32,
    marginHorizontal: 8,
    justifyContent: 'space-between',
  },
  cardPast: {
    opacity: 0.5,
  },
  cardToday: {
    borderColor: '#4a9eff',
    borderWidth: 2,
  },
  cardHeader: {
    marginBottom: 24,
  },
  cardDate: {
    fontSize: 20,
    fontWeight: '400',
    color: '#ffffff',
    marginBottom: 12,
  },
  activeBadge: {
    backgroundColor: '#4a9eff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 1,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  messageText: {
    fontSize: 18,
    lineHeight: 28,
    color: '#ffffff',
    fontWeight: '300',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  cardFooter: {
    marginTop: 24,
    alignItems: 'center',
  },
  editHint: {
    fontSize: 14,
    color: '#666',
  },
  textMuted: {
    color: '#666',
  },
  scrollHint: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scrollHintText: {
    fontSize: 12,
    color: '#666',
  },
});
