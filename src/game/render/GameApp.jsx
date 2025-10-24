import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GameRenderer } from './GameRenderer';
import { GameCore } from '../core/GameCore';

const { width, height } = Dimensions.get('window');

/**
 * GameApp - Main game component
 * Separated so it can be dynamically imported after Skia loads
 */
export function GameApp() {
  // Game physics core
  const gameCore = useRef(null);
  const [, forceUpdate] = useState(0);

  // Mascot position from physics
  const mascotPos = useRef({ x: width / 2, y: 100 });
  const obstacles = useRef([]);

  // Simple line drawing state
  const [lines, setLines] = useState([]);
  const [currentLine, setCurrentLine] = useState(null);

  useEffect(() => {
    // Initialize physics
    gameCore.current = new GameCore(width, height);

    let animationFrameId;
    let lastTime = performance.now();

    const animate = (currentTime) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      // Update physics simulation
      gameCore.current.step(deltaTime);

      // Get updated positions from physics
      mascotPos.current = gameCore.current.getMascotPosition();
      obstacles.current = gameCore.current.getObstacles();

      // Force re-render
      forceUpdate(n => n + 1);

      // Continue animation loop
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      gameCore.current.destroy();
    };
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
        mascotX={mascotPos.current.x}
        mascotY={mascotPos.current.y}
        obstacles={obstacles.current}
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
