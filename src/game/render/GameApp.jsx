import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions, TouchableOpacity, Text, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GameRenderer } from './GameRenderer';
import { GameCore } from '../core/GameCore';
import { config } from '../../config';
import { AdminPortal } from '../../admin/AdminPortal';

/**
 * GameApp - Main game component
 * Separated so it can be dynamically imported after Skia loads
 */
export function GameApp() {
  // Responsive dimensions - updates on window resize
  const [dimensions, setDimensions] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  });
  // Game physics core
  const gameCore = useRef(null);
  const [, forceUpdate] = useState(0);

  // Mascot position from physics
  const mascotPos = useRef({ x: dimensions.width / 2, y: 100 });
  const obstacles = useRef([]);
  const bounceImpact = useRef(null); // Bounce impact data for visual deformation
  const gelatoCreationTime = useRef(null); // Track creation time for pop-in animation
  const lastGelatoData = useRef(null); // Track last gelato data to detect changes
  const currentWord = useRef(null); // Current word being displayed
  const mascotVelocityY = useRef(0); // Current Y velocity of mascot

  // Simple line drawing state
  const [lines, setLines] = useState([]);
  const [currentPath, setCurrentPath] = useState(null); // Array of {x, y} points

  // Admin portal state
  const [showAdmin, setShowAdmin] = useState(false);
  const gameOpacity = useRef(new Animated.Value(1)).current;
  const adminOpacity = useRef(new Animated.Value(0)).current;

  // Initialize physics once on mount
  useEffect(() => {
    // Initialize physics with current dimensions
    gameCore.current = new GameCore(dimensions.width, dimensions.height);

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
      gelatoCreationTime.current = gameCore.current.getGelatoCreationTime();
      currentWord.current = gameCore.current.getCurrentWord();
      mascotVelocityY.current = gameCore.current.getMascotVelocityY();

      // Sync lines with GameCore (updates when gelato destroyed after fade)
      const currentGelatoData = gameCore.current.getGelatoLineData();
      if (currentGelatoData !== lastGelatoData.current) {
        lastGelatoData.current = currentGelatoData;
        setLines(currentGelatoData ? [currentGelatoData] : []);
      }

      // Force re-render
      forceUpdate(n => n + 1);

      // Continue animation loop
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (gameCore.current) {
        gameCore.current.destroy();
      }
    };
  }, []); // Only on mount

  // Handle window resize - update boundaries without resetting game
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      const newDimensions = { width: window.width, height: window.height };
      setDimensions(newDimensions);

      // Update boundaries live without destroying game
      if (gameCore.current) {
        gameCore.current.updateBoundaries(newDimensions.width, newDimensions.height);
      }
    });

    return () => subscription?.remove();
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

  // Admin portal toggle functions
  const openAdmin = () => {
    setShowAdmin(true);
    Animated.parallel([
      Animated.timing(gameOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(adminOpacity, { toValue: 1, duration: 400, useNativeDriver: true })
    ]).start();
  };

  const closeAdmin = () => {
    Animated.parallel([
      Animated.timing(adminOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(gameOpacity, { toValue: 1, duration: 400, useNativeDriver: true })
    ]).start(() => {
      setShowAdmin(false);
    });
  };

  return (
    <View style={styles.container}>
      {/* Game view with fade animation */}
      <Animated.View
        style={[styles.fullScreen, { opacity: gameOpacity, pointerEvents: showAdmin ? 'none' : 'auto' }]}
        onStartShouldSetResponder={() => true}
        onResponderGrant={handleTouchStart}
        onResponderMove={handleTouchMove}
        onResponderRelease={handleTouchEnd}
      >
        <GameRenderer
          width={dimensions.width}
          height={dimensions.height}
          mascotX={mascotPos.current.x}
          mascotY={mascotPos.current.y}
          obstacles={obstacles.current}
          lines={lines}
          currentPath={currentPath}
          bounceImpact={bounceImpact.current}
          gelatoCreationTime={gelatoCreationTime.current}
          currentWord={currentWord.current}
          mascotVelocityY={mascotVelocityY.current}
        />

        {/* Temporary Admin Button (will be replaced with staircase unlock) */}
        {!showAdmin && (
          <TouchableOpacity style={styles.adminButton} onPress={openAdmin}>
            <Text style={styles.adminButtonText}>Admin</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Admin portal with fade animation */}
      {showAdmin && (
        <Animated.View style={[styles.fullScreen, { opacity: adminOpacity }]}>
          <AdminPortal onClose={closeAdmin} />
        </Animated.View>
      )}

      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  adminButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#4a9eff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 1000,
  },
  adminButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
