import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, TextInput, Animated as RNAnimated } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, withDelay } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

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
  editCardWidth,
  editCardHeight,
  cardSpacing,
  editingText,
  setEditingText,
  textInputRefs,
  handleCardPress,
  handleBackFromEdit,
  onSelectDate,
  formatDate,
  cardIndex,
  todayIndex,
  isExiting,
}) {
  // Shared values for animations
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1); // Start visible so we see them rise
  const translateY = useSharedValue(500); // Start below screen
  const borderOpacity = useSharedValue(1); // Border starts visible
  const backgroundOpacity = useSharedValue(1); // Background starts visible

  // Calculate delay relative to today's card (so today starts immediately)
  const relativeIndex = cardIndex - todayIndex;
  const delay = Math.abs(relativeIndex) * 20; // Stagger outward from today

  // Entrance animation - cards fly up from bottom
  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withSpring(0, {
        damping: 22,      // Balanced - subtle bounce
        stiffness: 300,   // Fast but not too stiff
        mass: 0.8,        // Slight weight
      })
    );
  }, []);

  // Exit animation - all cards drop down together (no stagger)
  useEffect(() => {
    if (isExiting) {
      translateY.value = withSpring(500, {
        damping: 22,
        stiffness: 300,
        mass: 0.8,
      });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [isExiting]);

  // Animate when editing state changes
  useEffect(() => {
    if (isEditing) {
      scale.value = withSpring(1.1, { damping: 25, stiffness: 400, mass: 0.5 });
      opacity.value = withTiming(1, { duration: 200 });
      borderOpacity.value = withTiming(0, { duration: 300 }); // Fade out border
      backgroundOpacity.value = withTiming(0, { duration: 300 }); // Fade out background
    } else if (isOtherCardEditing) {
      scale.value = withTiming(1, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 }); // Completely disappear
    } else {
      scale.value = withSpring(1, { damping: 25, stiffness: 400, mass: 0.5 });
      opacity.value = withTiming(1, { duration: 200 });
      borderOpacity.value = withTiming(1, { duration: 300 }); // Fade in border
      backgroundOpacity.value = withTiming(1, { duration: 300 }); // Fade in background
    }
  }, [isEditing, isOtherCardEditing]);

  // Animated style for wrapper
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value }
    ],
    opacity: opacity.value,
    width: cardSize + cardSpacing, // Include spacing for snapToInterval
    scrollSnapAlign: 'center', // CSS scroll snap for web
  }));

  // Animated style for card border and background
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(255, 255, 255, ${borderOpacity.value})`,
    backgroundColor: `rgba(17, 17, 17, ${backgroundOpacity.value})`,
  }));

  return (
    <Animated.View style={[animatedStyle, { alignItems: 'center' }]}>
      <Animated.View
        style={[
          styles.card,
          cardAnimatedStyle,
          {
            width: isEditing ? editCardWidth : cardSize,
            height: isEditing ? editCardHeight : cardSize,
          },
          slot.isPast && styles.cardPast,
          slot.isToday && styles.cardToday,
        ]}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={(e) => {
            if (!isEditing) {
              e.stopPropagation();
              handleCardPress(slot.date, message?.text || '', isEditable, cardIndex);
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
            placeholder="Write a message"
            placeholderTextColor="#666"
            multiline
            scrollEnabled={true}
            editable={isEditing}
            showSoftInputOnFocus={isEditing}
            textAlign="center"
          />
        </View>

        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * CalendarView - Horizontal scrolling card-based calendar
 */
export function CalendarView({ scheduledMessages, onSelectDate, onClose, initialEditingDate, initialEditingText, scrollToDate, onScrollComplete }) {
  const { width, height } = Dimensions.get('window');
  const scrollViewRef = useRef(null);
  const textInputRefs = useRef({}).current;
  const [editingDate, setEditingDate] = useState(initialEditingDate || null);
  const [editingText, setEditingText] = useState(initialEditingText || '');
  const [isExiting, setIsExiting] = useState(false);
  const previewButtonTranslateY = useRef(new RNAnimated.Value(200)).current; // Start off-screen

  // Animate preview button based on whether there's text
  useEffect(() => {
    if (editingText.trim()) {
      RNAnimated.spring(previewButtonTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 300,
      }).start();
    } else {
      RNAnimated.spring(previewButtonTranslateY, {
        toValue: 200,
        useNativeDriver: true,
        damping: 20,
        stiffness: 300,
      }).start();
    }
  }, [editingText]);

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
  const editCardWidth = width - 100; // Full width minus left/right padding
  const editCardHeight = height - 100; // Full height minus top/bottom padding

  // Calculate initial scroll position to today's card
  const initialScrollX = todayIndex !== -1 ? todayIndex * snapInterval : 0;

  // Scroll to today's card immediately on mount
  useEffect(() => {
    if (scrollViewRef.current && todayIndex !== -1) {
      // Use requestAnimationFrame to ensure DOM is ready, but no visible delay
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ x: initialScrollX, animated: false });
      });
    }
  }, []);

  // Scroll to specific card when scrollToDate changes (after saving)
  useEffect(() => {
    if (scrollToDate && scrollViewRef.current) {
      const dateIndex = slots.findIndex(slot => slot.date === scrollToDate);
      if (dateIndex !== -1) {
        const scrollX = dateIndex * snapInterval;
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ x: scrollX, animated: true });
          if (onScrollComplete) {
            setTimeout(onScrollComplete, 300); // Call after scroll animation
          }
        }, 100); // Small delay to ensure view is visible
      }
    }
  }, [scrollToDate]);

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
  const handleCardPress = (dateStr, messageText, isEditable, cardIndex) => {
    if (!isEditable) return;

    // Immediately expand the card for responsiveness
    setEditingDate(dateStr);
    setEditingText(messageText || '');

    // Scroll to the clicked card (happens simultaneously with expansion)
    if (scrollViewRef.current && cardIndex !== undefined) {
      const scrollX = cardIndex * snapInterval;
      scrollViewRef.current.scrollTo({ x: scrollX, animated: true });
    }

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

  // Handle preview button press - just navigate, AdminPortal handles fade
  const handlePreview = () => {
    // Don't call handleBackFromEdit - let AdminPortal handle the transition
    onSelectDate(editingDate, editingText);
  };

  return (
    <View style={styles.container}>
      {/* Back button - always shown in top left */}
      <TouchableOpacity
        onPress={editingDate ? handleBackFromEdit : handleClose}
        style={styles.backButton}
      >
        <Feather name="arrow-left" size={28} color="#ffffff" />
      </TouchableOpacity>

      {/* Horizontal scrolling cards */}
      <TouchableOpacity
        style={styles.scrollView}
        activeOpacity={1}
        onPress={editingDate ? handleBackFromEdit : undefined}
        disabled={!editingDate}
        pointerEvents="box-none"
      >
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={!editingDate}
          snapToInterval={snapInterval}
          decelerationRate="fast"
          snapToAlignment="center"
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
                editCardWidth={editCardWidth}
                editCardHeight={editCardHeight}
                cardSpacing={cardSpacing}
                editingText={editingText}
                setEditingText={setEditingText}
                textInputRefs={textInputRefs}
                handleCardPress={handleCardPress}
                handleBackFromEdit={handleBackFromEdit}
                onSelectDate={onSelectDate}
                formatDate={formatDate}
                cardIndex={index}
                todayIndex={todayIndex}
                isExiting={isExiting}
              />
            );
          })}
        </ScrollView>
      </TouchableOpacity>

      {/* Preview button - anchored to bottom center of viewport */}
      {editingDate && (
        <RNAnimated.View
          style={[
            styles.previewButtonContainer,
            { transform: [{ translateY: previewButtonTranslateY }] }
          ]}
        >
          <TouchableOpacity
            style={styles.previewButton}
            onPress={handlePreview}
            disabled={!editingText.trim()}
          >
            <View style={styles.previewButtonContent}>
              <Feather name="play" size={20} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.previewButtonText}>
                Preview
              </Text>
            </View>
          </TouchableOpacity>
        </RNAnimated.View>
      )}
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
  scrollView: {
    flex: 1,
    scrollSnapType: 'x mandatory', // CSS scroll snap for web
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
    padding: 64,
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
    alignItems: 'center',
  },
  cardDate: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
    marginBottom: 12,
    letterSpacing: 1,
    textAlign: 'center',
  },
  activeBadge: {
    backgroundColor: '#4a9eff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'center',
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
    fontSize: 32,
    lineHeight: 60,
    color: '#ffffff',
    fontWeight: '300',
    width: '100%',
    textAlign: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
    outlineStyle: 'none',
    borderWidth: 0,
  },
  previewButtonContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    paddingHorizontal: 50,
  },
  previewButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#ffffff',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 999,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  previewButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  previewButtonDisabled: {
    opacity: 0.3,
  },
  textMuted: {
    color: '#666',
  },
});
