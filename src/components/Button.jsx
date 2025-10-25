import React, { useRef } from 'react';
import { TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { playSound } from '../utils/audio';

/**
 * Button - Universal button component with scale animation and click sound
 *
 * Scales up on press down, scales back on press up
 * Plays click.wav sound on every button press
 * Use this for all interactive buttons in the app
 *
 * @param {object} props
 * @param {function} props.onPress - Function to call when button is pressed
 * @param {React.Node} props.children - Button content
 * @param {object} props.style - Additional styles for the button
 * @param {boolean} props.disabled - Whether button is disabled
 * @param {number} props.scaleAmount - How much to scale (default: 1.3 for 30% bigger, or 0 to disable animation)
 */
export function Button({
  onPress,
  children,
  style,
  disabled = false,
  scaleAmount = 1.3,
  ...otherProps
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    // Only animate if scaleAmount is provided and > 0
    if (scaleAmount > 0) {
      // Spring animation on press down - bouncy and energetic
      Animated.spring(scaleAnim, {
        toValue: scaleAmount,
        useNativeDriver: true,
        friction: 5,
        tension: 200,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (scaleAmount > 0) {
      // Simple ease on release - smooth and quick
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePress = () => {
    if (disabled) return;

    // Play universal click sound for all buttons
    playSound('click');

    // Call the user's onPress handler
    if (onPress) {
      onPress();
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={1} // Disable default opacity change since we're using scale
        style={[{ justifyContent: 'center', alignItems: 'center' }, style]}
        {...otherProps}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({});
