import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GameRenderer } from './GameRenderer';

const { width, height } = Dimensions.get('window');

/**
 * GameApp - Main game component
 * Separated so it can be dynamically imported after Skia loads
 */
export function GameApp() {
  // Use refs for animation state (avoids React re-render overhead)
  const mascotYRef = useRef(100);
  const velocityRef = useRef(0);
  const [, forceUpdate] = useState(0);

  // Simple line drawing state
  const [lines, setLines] = useState([]);
  const [currentLine, setCurrentLine] = useState(null);

  useEffect(() => {
    let animationFrameId;

    const animate = () => {
      // Update physics
      const newY = mascotYRef.current + velocityRef.current;

      // Simple bounce at bottom
      if (newY > height - 50) {
        velocityRef.current = -8;
        mascotYRef.current = height - 50;
      } else {
        mascotYRef.current = newY;
      }

      velocityRef.current += 0.5; // Gravity

      // Force re-render
      forceUpdate(n => n + 1);

      // Continue animation loop
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Touch handlers for drawing lines
  const handleTouchStart = (event) => {
    const touch = event.nativeEvent.touches?.[0] || event.nativeEvent;
    setCurrentLine({
      startX: touch.pageX,
      startY: touch.pageY,
      endX: touch.pageX,
      endY: touch.pageY,
    });
  };

  const handleTouchMove = (event) => {
    if (!currentLine) return;
    const touch = event.nativeEvent.touches?.[0] || event.nativeEvent;
    setCurrentLine({
      ...currentLine,
      endX: touch.pageX,
      endY: touch.pageY,
    });
  };

  const handleTouchEnd = () => {
    if (currentLine) {
      setLines([...lines, currentLine]);
      setCurrentLine(null);
    }
  };

  return (
    <View
      style={styles.container}
      onStartShouldSetResponder={() => true}
      onResponderGrant={handleTouchStart}
      onResponderMove={handleTouchMove}
      onResponderRelease={handleTouchEnd}
    >
      <GameRenderer
        width={width}
        height={height}
        mascotX={width / 2}
        mascotY={mascotYRef.current}
        lines={lines}
        currentLine={currentLine}
      />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
});
