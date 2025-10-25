import React, { useRef } from 'react';
import { TouchableOpacity, Animated, StyleSheet } from 'react-native';

/**
 * Button - Universal button component with scale animation
 *
 * Scales up on press down, scales back on press up
 * Use this for all interactive buttons in the app
 *
 * @param {object} props
 * @param {function} props.onPress - Function to call when button is pressed
 * @param {React.Node} props.children - Button content
 * @param {object} props.style - Additional styles for the button
 * @param {boolean} props.disabled - Whether button is disabled
 * @param {number} props.scaleAmount - How much to scale (default: 1.05 for 5% bigger)
 */
export function Button({
  onPress,
  children,
  style,
  disabled = false,
  scaleAmount = 1.05,
  ...otherProps
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: scaleAmount,
      useNativeDriver: true,
      friction: 5,
      tension: 200,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
      tension: 200,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={1} // Disable default opacity change since we're using scale
      style={style}
      {...otherProps}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({});
