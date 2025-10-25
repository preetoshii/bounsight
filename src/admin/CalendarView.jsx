import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, TextInput } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, withDelay } from 'react-native-reanimated';

/**
 * Individual Card Item with Reanimated animations
 */
function CardItem({
  slot,
  message,
  isEditable,
  isEditing,
  isOtherCardEditing,
  cardSize,
  editCardSize,
  editingText,
  setEditingText,
  textInputRefs,
  handleCardPress,
  handleBackFromEdit,
  onSelectDate,
  formatDate,
  cardIndex,
  isExiting,
}) {
  // Shared values for animations
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1); // Start visible so we see them rise
  const translateY = useSharedValue(500); // Start below screen

  // Entrance animation - cards fly up from bottom one by one (balanced spring)
  useEffect(() => {
    const delay = cardIndex * 20; // Stagger each card by 20ms (faster)
    translateY.value = withDelay(
      delay,
      withSpring(0, {
        damping: 22,      // Balanced - subtle bounce
        stiffness: 300,   // Fast but not too stiff
        mass: 0.8,        // Slight weight
      })
    );
  }, [cardIndex]);

  // Exit animation - cards drop down one by one
  useEffect(() => {
    if (isExiting) {
      const delay = cardIndex * 15; // Stagger exit (faster)
      translateY.value = withDelay(
        delay,
        withSpring(500, {
          damping: 22,
          stiffness: 300,
          mass: 0.8,
        })
      );
      opacity.value = withDelay(delay, withTiming(0, { duration: 200 }));
    }
  }, [isExiting, cardIndex]);

  // Animate when editing state changes
  useEffect(() => {
    if (isEditing) {
      scale.value = withSpring(1.1, { damping: 15, stiffness: 150 });
      opacity.value = withTiming(1, { duration: 300 });
    } else if (isOtherCardEditing) {
      scale.value = withTiming(1, { duration: 300 });
      opacity.value = withTiming(0.2, { duration: 300 });
    } else {
      scale.value = withSpring(1, { damping: 15, stiffness: 150 });
      opacity.value = withTiming(1, { duration: 300 });
    }
  }, [isEditing, isOtherCardEditing]);

  // Animated style
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value }
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[
          styles.card,
          {
            width: isEditing ? editCardSize : cardSize,
            height: isEditing ? editCardSize : cardSize,
          },
          slot.isPast && styles.cardPast,
          slot.isToday && styles.cardToday,
        ]}
        onPress={(e) => {
          if (!isEditing) {
            e.stopPropagation();
            handleCardPress(slot.date, message?.text || '', isEditable);
          }
        }}
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

        {/* Message input/display - always the same element */}
        <View style={styles.cardContent} pointerEvents={isEditing ? 'auto' : 'none'}>
          <TextInput
            ref={(ref) => { textInputRefs[slot.date] = ref; }}
            style={styles.messageInput}
            value={isEditing ? editingText : (message?.text || '')}
            onChangeText={isEditing ? setEditingText : undefined}
            placeholder="Tap to add a message"
            placeholderTextColor="#666"
            multiline
            editable={isEditing}
            showSoftInputOnFocus={isEditing}
            textAlign="center"
          />
        </View>

        {/* Edit icon for editable dates (hidden when editing) */}
        {!slot.isPast && !isEditing && (
          <View style={styles.editIcon}>
            <Text style={styles.editIconText}>✎</Text>
          </View>
        )}

        {/* Preview button when editing */}
        {isEditing && (
          <TouchableOpacity
            style={styles.previewButton}
            onPress={(e) => {
              e.stopPropagation();
              // Exit edit mode and go to preview
              handleBackFromEdit();
              onSelectDate(slot.date, editingText);
            }}
            disabled={!editingText.trim()}
          >
            <Text style={[styles.previewButtonText, !editingText.trim() && styles.previewButtonDisabled]}>
              Preview
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * CalendarView - Horizontal scrolling card-based calendar
 */
export function CalendarView({ scheduledMessages, onSelectDate, onClose }) {
  const { width, height } = Dimensions.get('window');
  const scrollViewRef = useRef(null);
  const textInputRefs = useRef({}).current;
  const [editingDate, setEditingDate] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [isExiting, setIsExiting] = useState(false);

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

  // Find today's index for scrolling
  const todayIndex = slots.findIndex(slot => slot.isToday);

  // Card dimensions - square aspect ratio
  const cardSize = Math.min(width * 0.75, height * 0.6);
  const cardSpacing = 64;
  const snapInterval = cardSize + cardSpacing;
  const editCardSize = Math.min(width * 0.9, height * 0.75);

  // Scroll to today's card on mount
  useEffect(() => {
    if (scrollViewRef.current && todayIndex !== -1) {
      setTimeout(() => {
        const scrollX = todayIndex * snapInterval;
        scrollViewRef.current?.scrollTo({ x: scrollX, animated: false });
      }, 100);
    }
  }, []);

  const formatDate = (dateStr, isToday) => {
    const date = new Date(dateStr + 'T00:00:00');
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
    const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    if (isToday) {
      return `TODAY, ${monthDay}`.toUpperCase();
    }
    return `${weekday}, ${monthDay}`.toUpperCase();
  };

  const getMessageForDate = (dateStr) => {
    return scheduledMessages[dateStr] || null;
  };

  // Handle card tap
  const handleCardPress = (dateStr, messageText, isEditable) => {
    if (!isEditable) return;
    setEditingDate(dateStr);
    setEditingText(messageText || '');

    setTimeout(() => {
      textInputRefs[dateStr]?.focus();
    }, 100);
  };

  // Handle back from edit mode
  const handleBackFromEdit = () => {
    setEditingDate(null);
    setEditingText('');
  };

  // Handle close with exit animation
  const handleClose = () => {
    setIsExiting(true);
    // Trigger view transition immediately - cards will exit as view fades
    onClose();
  };

  return (
    <View style={styles.container}>
      {/* Back button (absolute positioned) */}
      {editingDate && (
        <TouchableOpacity onPress={handleBackFromEdit} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      )}

      {/* Title (absolute positioned) */}
      {!editingDate && (
        <Text style={styles.headerTitle}>Messages</Text>
      )}

      {/* Close button (absolute positioned) */}
      {!editingDate && (
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      )}

      {/* Horizontal scrolling cards */}
      <TouchableOpacity
        style={styles.scrollView}
        activeOpacity={1}
        onPress={editingDate ? handleBackFromEdit : undefined}
        disabled={!editingDate}
      >
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={!editingDate}
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingLeft: (width - cardSize) / 2, paddingRight: (width - cardSize) / 2 }]}
        >
          {slots.map((slot, index) => {
            const message = getMessageForDate(slot.date);
            const isEditable = !slot.isPast;
            const isEditing = editingDate === slot.date;
            const isOtherCardEditing = editingDate && !isEditing;

            return (
              <CardItem
                key={slot.date}
                slot={slot}
                message={message}
                isEditable={isEditable}
                isEditing={isEditing}
                isOtherCardEditing={isOtherCardEditing}
                cardSize={cardSize}
                editCardSize={editCardSize}
                editingText={editingText}
                setEditingText={setEditingText}
                textInputRefs={textInputRefs}
                handleCardPress={handleCardPress}
                handleBackFromEdit={handleBackFromEdit}
                onSelectDate={onSelectDate}
                formatDate={formatDate}
                cardIndex={index}
                isExiting={isExiting}
              />
            );
          })}
        </ScrollView>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  headerTitle: {
    position: 'absolute',
    top: 50,
    left: 50,
    fontSize: 24,
    fontWeight: '300',
    color: '#ffffff',
    zIndex: 100,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 50,
    padding: 8,
    zIndex: 100,
  },
  backButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '400',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 50,
    padding: 8,
    zIndex: 100,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  card: {
    backgroundColor: '#111',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#ffffff',
    padding: 32,
    marginRight: 64,
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
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
    marginBottom: 12,
    letterSpacing: 1,
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
    alignItems: 'center',
  },
  messageInput: {
    fontSize: 24,
    lineHeight: 36,
    color: '#ffffff',
    fontWeight: '300',
    width: '100%',
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingVertical: 0,
    outlineStyle: 'none',
    borderWidth: 0,
  },
  editIcon: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  editIconText: {
    fontSize: 20,
    color: '#666',
  },
  previewButton: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  previewButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0a0a0a',
  },
  previewButtonDisabled: {
    opacity: 0.3,
  },
  textMuted: {
    color: '#666',
  },
});
