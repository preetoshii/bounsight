import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions, TouchableOpacity, Text, Animated, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { GameRenderer } from './GameRenderer';
import { GameCore } from '../core/GameCore';
import { config } from '../../config';
import { AdminPortal } from '../../admin/AdminPortal';
import { playSound } from '../../utils/audio';
import { preloadMessageAudio } from '../../services/audioPlayer';
import { generateAudioForMessage } from '../../services/wordAudioService';
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

  // Simple line drawing state
  const [lines, setLines] = useState([]);
  const [currentPath, setCurrentPath] = useState(null); // Array of {x, y} points

  // Admin portal state
  const [showAdmin, setShowAdmin] = useState(false);
  const [preloadedMessagesData, setPreloadedMessagesData] = useState(null);
  const gameOpacity = useRef(new Animated.Value(1)).current;
  const adminOpacity = useRef(new Animated.Value(0)).current;

  // Audio generation state
  const [audioGenerating, setAudioGenerating] = useState(false);
  const [audioGenStatus, setAudioGenStatus] = useState('');

  // Remount counter - increment to force remount main game
  const [gameMountKey, setGameMountKey] = useState(0);

  // Animation frame ref (needs to be accessible to pause/resume)
  const animationFrameId = useRef(null);

  // Initialize physics once on mount
  useEffect(() => {
    // Initialize physics with current dimensions
    gameCore.current = new GameCore(dimensions.width, dimensions.height);

    // Wait for message to load from GitHub, THEN preload audio
    const loadOrGenerateAudio = async () => {
      try {
        // Wait for message to load from GitHub (if not preview mode)
        await gameCore.current.messageLoadPromise;

        // NOW get the loaded message text
        const messageText = gameCore.current.message.join(' ');
        const words = gameCore.current.message;

        console.log(`🎵 Preloading audio for message: "${messageText}"`);

        // Try to preload existing audio
        const { loaded, failed } = await preloadMessageAudio(messageText);

        console.log(`✓ Audio preloaded: ${loaded.length} words`);

        // If NO audio loaded and we have words, or if any words failed to load, generate them
        const needsGeneration = (loaded.length === 0 && words.length > 0) || failed.length > 0;

        if (needsGeneration) {
          console.log(`🎤 Generating missing audio for message...`);
          setAudioGenerating(true);
          setAudioGenStatus(`Checking for new words...`);

          const result = await generateAudioForMessage(messageText, (word, current, total) => {
            setAudioGenStatus(`Generating audio: "${word}" (${current}/${total})`);
          });

          if (result.generated.length > 0) {
            console.log(`✓ Generated audio for ${result.generated.length} word(s)`);

            // Now preload the newly generated audio
            const { loaded: newLoaded } = await preloadMessageAudio(messageText);
            console.log(`✓ Loaded ${newLoaded.length} word audio files`);
          } else {
            console.log(`✓ All words already have audio`);
          }

          setAudioGenerating(false);
          setAudioGenStatus('');
        }
      } catch (error) {
        console.error('Failed to load/generate audio:', error);
        setAudioGenerating(false);
        setAudioGenStatus('');
      }
    };

    loadOrGenerateAudio();

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
    } else {
      // Resume animation loop when admin closes (if not already running)
      if (!animationFrameId.current && gameCore.current) {
        let lastTime = performance.now();

        const animate = (currentTime) => {
          const deltaTime = currentTime - lastTime;
          lastTime = currentTime;

          const cappedDelta = Math.min(deltaTime, 16.667);
          gameCore.current.step(cappedDelta);

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
          />

          {/* Admin Button - Feather Icon */}
          <Button onPress={openAdmin} style={styles.adminButton}>
            <Feather name="feather" size={20} color="#ffffff" style={{ opacity: 0.6 }} />
          </Button>
        </View>
      )}

      {/* Admin portal - unmount when closed */}
      {showAdmin && (
        <View style={styles.fullScreen}>
          <AdminPortal onClose={closeAdmin} preloadedData={preloadedMessagesData} />
        </View>
      )}

      {/* Audio generation status indicator */}
      {audioGenerating && (
        <View style={styles.audioStatusContainer}>
          <View style={styles.audioStatusBox}>
            <ActivityIndicator size="small" color="#ffffff" />
            <Text style={styles.audioStatusText}>{audioGenStatus}</Text>
          </View>
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
  audioStatusContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2000,
  },
  audioStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 20,
    gap: 12,
  },
  audioStatusText: {
    color: '#ffffff',
    fontSize: 14,
  },
});
