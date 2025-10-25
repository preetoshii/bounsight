import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GameRenderer } from './GameRenderer';
import { GameCore } from '../core/GameCore';
import { config } from '../../config';

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
  const bounceImpact = useRef(null); // Bounce impact data for visual deformation

  // Simple line drawing state
  const [lines, setLines] = useState([]);
  const [currentPath, setCurrentPath] = useState(null); // Array of {x, y} points

  useEffect(() => {
    // Initialize physics
    gameCore.current = new GameCore(width, height);

    let animationFrameId;
    let lastTime = performance.now();

    const animate = (currentTime) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      // Cap delta time to 16.667ms (60fps) to avoid Matter.js warnings
      const cappedDelta = Math.min(deltaTime, 16.667);

      // Update physics simulation
      gameCore.current.step(cappedDelta);

      // Get updated positions from physics
      mascotPos.current = gameCore.current.getMascotPosition();
      obstacles.current = gameCore.current.getObstacles();
      bounceImpact.current = gameCore.current.getBounceImpact();

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

  // Helper: Calculate total path length
  const calculatePathLength = (points) => {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  };

  // Helper: Trim path from start to maintain max length
  const trimPathToMaxLength = (points, maxLength) => {
    let totalLength = calculatePathLength(points);
    let trimmedPoints = [...points];

    while (totalLength > maxLength && trimmedPoints.length > 2) {
      // Remove first point
      const dx = trimmedPoints[1].x - trimmedPoints[0].x;
      const dy = trimmedPoints[1].y - trimmedPoints[0].y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);

      trimmedPoints.shift();
      totalLength -= segmentLength;
    }

    return trimmedPoints;
  };

  // Touch handlers for drawing lines
  const handleTouchStart = (event) => {
    const touch = event.nativeEvent.touches?.[0] || event.nativeEvent;
    setCurrentPath([{ x: touch.pageX, y: touch.pageY }]);
  };

  const handleTouchMove = (event) => {
    if (!currentPath) return;
    const touch = event.nativeEvent.touches?.[0] || event.nativeEvent;

    // Add current point to path
    const newPath = [...currentPath, { x: touch.pageX, y: touch.pageY }];

    // Trim path if it exceeds max length (sliding start)
    const trimmedPath = trimPathToMaxLength(newPath, config.gelato.maxLength);

    setCurrentPath(trimmedPath);
  };

  const handleTouchEnd = () => {
    if (currentPath && currentPath.length >= 2 && gameCore.current) {
      // Create straight-line Gelato from first to last point of path
      const startPoint = currentPath[0];
      const endPoint = currentPath[currentPath.length - 1];

      const gelatoLine = gameCore.current.createGelato(
        startPoint.x,
        startPoint.y,
        endPoint.x,
        endPoint.y
      );

      // Store the clamped line for visual rendering
      if (gelatoLine) {
        setLines([gelatoLine]); // Replace old lines (only one Gelato at a time)
      }

      setCurrentPath(null);
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
        currentPath={currentPath}
        bounceImpact={bounceImpact.current}
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
