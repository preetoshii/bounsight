import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions, Pressable, Text, Animated, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { GameRenderer } from './GameRenderer';
import { GameCore } from '../core/GameCore';
import { config } from '../../config';
import { AdminPortal } from '../../admin/AdminPortal';
import { playSound } from '../../utils/audio';
import { fetchMessages } from '../../admin/githubApi';
import { Button } from '../../components/Button';

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
  const squashStretch = useRef({ scaleX: 1, scaleY: 1 }); // Squash/stretch for ball deformation

  // Simple line drawing state
  const [lines, setLines] = useState([]);
  const [currentPath, setCurrentPath] = useState(null); // Array of {x, y} points

  // Admin portal state
  const [showAdmin, setShowAdmin] = useState(false);
  const [preloadedMessagesData, setPreloadedMessagesData] = useState(null);
  const gameOpacity = useRef(new Animated.Value(1)).current;
  const adminOpacity = useRef(new Animated.Value(0)).current;

  // Remount counter - increment to force remount main game
  const [gameMountKey, setGameMountKey] = useState(0);

  // Animation frame ref (needs to be accessible to pause/resume)
  const animationFrameId = useRef(null);

  // Fixed timestep accumulator for framerate-independent physics
  const accumulator = useRef(0);
  const FIXED_TIMESTEP = 16.667; // 60 Hz physics updates (1000ms / 60 = 16.667ms)

  // Initialize physics once on mount
  useEffect(() => {
    // Initialize physics with current dimensions
    gameCore.current = new GameCore(dimensions.width, dimensions.height);

    let lastTime = performance.now();

    const animate = (currentTime) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      // Cap frame delta to prevent spiral of death (max 100ms if tab goes to background)
      const frameDelta = Math.min(deltaTime, 100);

      // Add frame time to accumulator
      accumulator.current += frameDelta;

      // Run physics updates in fixed 16.667ms timesteps
      // This decouples physics from rendering framerate
      // At 120 FPS: Run 1 physics step every 2 frames
      // At 60 FPS: Run 1 physics step every frame
      // At 30 FPS: Run 2 physics steps per frame
      while (accumulator.current >= FIXED_TIMESTEP) {
        gameCore.current.step(FIXED_TIMESTEP);
        accumulator.current -= FIXED_TIMESTEP;
      }

      // Get updated positions from physics (render at display refresh rate)
      mascotPos.current = gameCore.current.getMascotPosition();
      obstacles.current = gameCore.current.getObstacles();
      bounceImpact.current = gameCore.current.getBounceImpact();
      gelatoCreationTime.current = gameCore.current.getGelatoCreationTime();
      currentWord.current = gameCore.current.getCurrentWord();
      mascotVelocityY.current = gameCore.current.getMascotVelocityY();
      squashStretch.current = gameCore.current.getSquashStretch();

      // Sync lines with GameCore (updates when gelato destroyed after fade)
      const currentGelatoData = gameCore.current.getGelatoLineData();
      if (currentGelatoData !== lastGelatoData.current) {
        lastGelatoData.current = currentGelatoData;
        setLines(currentGelatoData ? [currentGelatoData] : []);
      }

      // Force re-render (at display refresh rate for smooth visuals)
      forceUpdate(n => n + 1);

      // Continue animation loop
      animationFrameId.current = requestAnimationFrame(animate);
    };

    animationFrameId.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (gameCore.current) {
        gameCore.current.destroy();
      }
    };
  }, []); // Only on mount

  // Pause/resume animation when admin portal opens/closes
  useEffect(() => {
    if (showAdmin) {
      // Pause animation loop when admin opens
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      // Reset accumulator to prevent time buildup while paused
      accumulator.current = 0;
    } else {
      // Resume animation loop when admin closes (if not already running)
      if (!animationFrameId.current && gameCore.current) {
        let lastTime = performance.now();

        const animate = (currentTime) => {
          const deltaTime = currentTime - lastTime;
          lastTime = currentTime;

          const frameDelta = Math.min(deltaTime, 100);
          accumulator.current += frameDelta;

          while (accumulator.current >= FIXED_TIMESTEP) {
            gameCore.current.step(FIXED_TIMESTEP);
            accumulator.current -= FIXED_TIMESTEP;
          }

          mascotPos.current = gameCore.current.getMascotPosition();
          obstacles.current = gameCore.current.getObstacles();
          bounceImpact.current = gameCore.current.getBounceImpact();
          gelatoCreationTime.current = gameCore.current.getGelatoCreationTime();
          currentWord.current = gameCore.current.getCurrentWord();
          mascotVelocityY.current = gameCore.current.getMascotVelocityY();

          const currentGelatoData = gameCore.current.getGelatoLineData();
          if (currentGelatoData !== lastGelatoData.current) {
            lastGelatoData.current = currentGelatoData;
            setLines(currentGelatoData ? [currentGelatoData] : []);
          }

          forceUpdate(n => n + 1);
          animationFrameId.current = requestAnimationFrame(animate);
        };

        animationFrameId.current = requestAnimationFrame(animate);
      }
    }
  }, [showAdmin])

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
  const openAdmin = async () => {
    playSound('card-slide');

    // Preload messages data to prevent flicker
    try {
      const data = await fetchMessages();
      setPreloadedMessagesData(data);
    } catch (error) {
      console.error('Failed to preload messages:', error);
      // Still open admin portal, it will handle the error
    }

    // Reset admin opacity to 1 before showing
    adminOpacity.setValue(1);
    setShowAdmin(true);
  };

  const closeAdmin = () => {
    setShowAdmin(false);
    // Reset game opacity to 1 and force remount of main game to reset physics
    gameOpacity.setValue(1);
    setGameMountKey(prev => prev + 1);
  };

  return (
    <View style={styles.container}>
      {/* Game view - unmount completely when admin is open */}
      {!showAdmin && (
        <View
          key={gameMountKey}
          style={styles.fullScreen}
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
            squashStretch={squashStretch.current}
          />

          {/* Admin Button - Feather Icon */}
          <Pressable onPress={openAdmin} style={styles.adminButton}>
            <Feather name="feather" size={20} color="#ffffff" style={{ opacity: 0.6 }} />
          </Pressable>
        </View>
      )}

      {/* Admin portal - unmount when closed */}
      {showAdmin && (
        <View style={styles.fullScreen}>
          <AdminPortal onClose={closeAdmin} preloadedData={preloadedMessagesData} />
        </View>
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
    right: 50,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});
