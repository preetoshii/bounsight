import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, TextInput, Animated as RNAnimated } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, withDelay } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { playSound } from '../utils/audio';
import { Pressable } from 'react-native';
import { useHorizontalScroll } from '../utils/useHorizontalScroll';

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
    width: isEditing ? editCardWidth : cardSize + cardSpacing, // Expand wrapper when editing
    scrollSnapAlign: 'center', // CSS scroll snap for web
  }));

  // Determine if card has content
  const hasMessage = message && message.text;

  // Animated style for card border and background
  const cardAnimatedStyle = useAnimatedStyle(() => {
    if (hasMessage && !isEditing) {
      // Populated card: white background, black text
      return {
        borderColor: `rgba(255, 255, 255, ${borderOpacity.value})`,
        backgroundColor: `rgba(255, 255, 255, ${backgroundOpacity.value})`,
        transform: [{ scale: scale.value }],
      };
    } else {
      // Empty card or editing: dark background, white text
      return {
        borderColor: `rgba(255, 255, 255, ${borderOpacity.value})`,
        backgroundColor: `rgba(17, 17, 17, ${backgroundOpacity.value})`,
        transform: [{ scale: scale.value }],
      };
    }
  });

  return (
    <Animated.View style={[animatedStyle, { alignItems: 'center' }]}>
      <TouchableOpacity
        onPress={(e) => {
          if (!isEditing) {
            e.stopPropagation();
            handleCardPress(slot.date, message?.text || '', isEditable, cardIndex);
          }
        }}
        disabled={slot.isPast}
        activeOpacity={1}
        style={{ width: '100%', height: '100%' }}
      >
        <Animated.View
          style={[
            styles.card,
            cardAnimatedStyle,
            {
              width: isEditing ? editCardWidth : cardSize,
              height: isEditing ? editCardHeight : cardSize,
              padding: isEditing ? 100 : 64, // More padding when expanded
            },
            slot.isPast && styles.cardPast,
            slot.isToday && styles.cardToday,
          ]}
        >
          {/* Date header */}
          <View style={styles.cardHeader}>
          <Text style={[
            styles.cardDate,
            slot.isPast && styles.textMuted,
            hasMessage && !isEditing && { color: '#0a0a0a' } // Black text for populated cards
          ]}>
            {formatDate(slot.date, slot.isToday)}
          </Text>
          {slot.isToday && (
            <View style={[
              styles.activeBadge,
              hasMessage && !isEditing && { backgroundColor: '#0a0a0a' } // Black badge for white cards
            ]}>
              <Text style={styles.activeBadgeText}>ACTIVE</Text>
            </View>
          )}
        </View>

        {/* Message input/display - always the same element */}
        <View style={styles.cardContent} pointerEvents={isEditing ? 'auto' : 'none'}>
          <TextInput
            ref={(ref) => { textInputRefs[slot.date] = ref; }}
            style={[
              styles.messageInput,
              hasMessage && !isEditing && { color: '#0a0a0a' } // Black text for populated cards
            ]}
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
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * CalendarView - Horizontal scrolling card-based calendar
 */
export function CalendarView({ scheduledMessages, onSelectDate, onPreview, initialEditingDate, initialEditingText, scrollToDate, onScrollComplete }) {
  const { width, height } = Dimensions.get('window');
  const scrollViewRef = useRef(null);
  const horizontalScrollRef = useHorizontalScroll(); // Hook for vertical-to-horizontal scroll translation
  const textInputRefs = useRef({}).current;
  const [editingDate, setEditingDate] = useState(initialEditingDate || null);
  const [editingText, setEditingText] = useState(initialEditingText || '');
  const previewButtonTranslateY = useRef(new RNAnimated.Value(200)).current; // Start off-screen

  // Sync with parent's editing state
  useEffect(() => {
    setEditingDate(initialEditingDate || null);
    setEditingText(initialEditingText || '');
  }, [initialEditingDate, initialEditingText]);

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

    // Play expand sound
    playSound('expand-card');

    // Immediately expand the card for responsiveness
    setEditingDate(dateStr);
    setEditingText(messageText || '');

    // Notify AdminPortal that we're entering edit mode
    onSelectDate(dateStr, messageText || '');

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

  // Handle preview button press - call onPreview to navigate to preview mode
  const handlePreview = () => {
    playSound('preview');
    // Pass the edited text to parent before navigating to preview
    onSelectDate(editingDate, editingText);
    onPreview();
  };

  return (
    <View style={styles.container}>
      {/* Horizontal scrolling cards */}
      <View ref={horizontalScrollRef} style={{ flex: 1 }}>
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
              />
            );
          })}
        </ScrollView>
      </TouchableOpacity>
      </View>

      {/* Preview button - anchored to bottom center of viewport */}
      {editingDate && (
        <RNAnimated.View
          style={[
            styles.previewButtonContainer,
            { transform: [{ translateY: previewButtonTranslateY }] }
          ]}
          pointerEvents={editingText.trim() ? 'auto' : 'none'} // Prevent clicks when hidden off-screen or disabled
        >
          <Pressable
            style={[
              styles.previewButton,
              !editingText.trim() && styles.previewButtonDisabled
            ]}
            onPress={() => {
              playSound('click');
              handlePreview();
            }}
            disabled={!editingText.trim()}
          >
            <View style={styles.previewButtonContent}>
              <Feather name="play" size={20} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.previewButtonText}>
                Preview
              </Text>
            </View>
          </Pressable>
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
    opacity: 0.3,
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
