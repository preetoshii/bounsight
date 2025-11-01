import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions, Pressable, Text, Animated, ActivityIndicator, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { GameRenderer } from './GameRenderer';
import { GameCore } from '../core/GameCore';
import { config } from '../../config';
import { AdminPortal } from '../../admin/AdminPortal';
import { playSound } from '../../utils/audio';
import { fetchMessages } from '../../admin/githubApi';
import { Button } from '../../components/Button';

// Only import react-native-rich-vibration on native platforms (not web)
const ReactNativeRichVibration = Platform.OS !== 'web'
  ? require('react-native-rich-vibration').default
  : null;

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

  // FPS monitoring (DEV ONLY)
  const fpsCounter = useRef({ frames: 0, lastTime: performance.now(), lastRenderTime: 0 });
  const [fps, setFps] = useState(60);

  // FPS cap control (DEV ONLY)
  const [fpsCap, setFpsCap] = useState(null); // null = uncapped, or 10-120
  const fpsCapOptions = [null, 10, 20, 30, 40, 50, 60, 70, 80, 90, 120];
  const [showFpsMenu, setShowFpsMenu] = useState(false);

  // Haptics debug menu (DEV ONLY)
  const [showHapticsMenu, setShowHapticsMenu] = useState(false);
  const [hapticsConfig, setHapticsConfig] = useState({
    gelatoCreation: config.haptics.gelatoCreation,
    gelatoBounce: config.haptics.gelatoBounce,
    wallBump: config.haptics.wallBump,
    loss: config.haptics.loss,
    drawing: config.haptics.drawing,
  });

  // Update global runtime config when haptics change (for audio.js to use)
  useEffect(() => {
    global.runtimeHapticsConfig = hapticsConfig;
  }, [hapticsConfig]);

  // Initialize physics once on mount
  useEffect(() => {
    // Initialize physics with current dimensions
    gameCore.current = new GameCore(dimensions.width, dimensions.height);

    let lastTime = performance.now();
    let lastFrameTime = performance.now(); // For FPS cap

    const animate = (currentTime) => {
      // Continue animation loop (always runs at display refresh rate)
      animationFrameId.current = requestAnimationFrame(animate);

      // FPS cap: Skip this frame if not enough time has passed
      const minFrameTime = fpsCap ? (1000 / fpsCap) : 0;
      if (fpsCap && (currentTime - lastFrameTime < minFrameTime)) {
        return; // Skip this frame entirely - don't update physics or render
      }
      lastFrameTime = currentTime;

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

      // Force re-render and monitor FPS
      forceUpdate(n => n + 1);

      fpsCounter.current.frames++;
      const now = performance.now();
      if (now >= fpsCounter.current.lastTime + 1000) {
        setFps(Math.round((fpsCounter.current.frames * 1000) / (now - fpsCounter.current.lastTime)));
        fpsCounter.current.frames = 0;
        fpsCounter.current.lastTime = now;
      }
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
        let lastFrameTime = performance.now();

        const animate = (currentTime) => {
          // Continue animation loop (always runs at display refresh rate)
          animationFrameId.current = requestAnimationFrame(animate);

          // FPS cap: Skip this frame if not enough time has passed
          const minFrameTime = fpsCap ? (1000 / fpsCap) : 0;
          if (fpsCap && (currentTime - lastFrameTime < minFrameTime)) {
            return; // Skip this frame entirely
          }
          lastFrameTime = currentTime;

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

          // Force re-render and monitor FPS
          forceUpdate(n => n + 1);

          fpsCounter.current.frames++;
          const now = performance.now();
          if (now >= fpsCounter.current.lastTime + 1000) {
            setFps(Math.round((fpsCounter.current.frames * 1000) / (now - fpsCounter.current.lastTime)));
            fpsCounter.current.frames = 0;
            fpsCounter.current.lastTime = now;
          }
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

  // Track last haptic position and time for drawing feedback
  const lastHapticPos = useRef(null);
  const lastHapticTime = useRef(0);

  // Touch handlers for drawing lines
  const handleTouchStart = (event) => {
    const touch = event.nativeEvent.touches?.[0] || event.nativeEvent;
    console.log('🎨 Touch start:', touch.pageX, touch.pageY);
    setCurrentPath([{ x: touch.pageX, y: touch.pageY }]);
    lastHapticPos.current = { x: touch.pageX, y: touch.pageY };
    lastHapticTime.current = Date.now();
  };

  const handleTouchMove = async (event) => {
    if (!currentPath) return;
    const touch = event.nativeEvent.touches?.[0] || event.nativeEvent;

    // Add current point to path
    const newPath = [...currentPath, { x: touch.pageX, y: touch.pageY }];

    // Trim path if it exceeds max length (sliding start)
    const trimmedPath = trimPathToMaxLength(newPath, config.gelato.maxLength);

    setCurrentPath(trimmedPath);

    // Trigger haptic feedback based on distance AND time (prevents overlap when moving fast)
    if (config.haptics.drawing.enabled && lastHapticPos.current) {
      const dx = touch.pageX - lastHapticPos.current.x;
      const dy = touch.pageY - lastHapticPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const timeSinceLastHaptic = Date.now() - lastHapticTime.current;

      // Trigger haptic only if BOTH distance and time thresholds are met
      if (distance >= config.haptics.drawing.pixelsPerTick &&
          timeSinceLastHaptic >= config.haptics.drawing.minIntervalMs) {
        // Trigger ultra-subtle haptic for drawing feedback using react-native-rich-vibration (native only)
        // This provides amplitude control for softer haptic feedback
        if (ReactNativeRichVibration) {
          try {
            ReactNativeRichVibration.vibrate(
              hapticsConfig.drawing.durationMs,
              hapticsConfig.drawing.intensity
            );
          } catch (error) {
            // Silently fail if haptics not available
          }
        }
        lastHapticPos.current = { x: touch.pageX, y: touch.pageY };
        lastHapticTime.current = Date.now();
      }
    }
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

          {/* FPS Counter (DEV ONLY) */}
          <Pressable onPress={() => setShowFpsMenu(!showFpsMenu)} style={styles.fpsCounter}>
            <Text style={styles.fpsText}>
              {fps} FPS {fpsCap ? `(${fpsCap} cap)` : '(uncapped)'} {showFpsMenu ? '▼' : '▶'}
            </Text>
          </Pressable>

          {/* FPS Cap Menu */}
          {showFpsMenu && (
            <View style={styles.fpsMenu}>
              {fpsCapOptions.map((cap) => (
                <Pressable
                  key={cap || 'uncapped'}
                  onPress={() => setFpsCap(cap)}
                  style={[
                    styles.fpsButton,
                    fpsCap === cap && styles.fpsButtonActive
                  ]}
                >
                  <Text style={styles.fpsButtonText}>
                    {cap ? `${cap} FPS` : 'Uncapped'} {fpsCap === cap && '✓'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Haptics Debug Menu (DEV ONLY) */}
          <Pressable onPress={() => setShowHapticsMenu(!showHapticsMenu)} style={[styles.fpsCounter, { top: 60 }]}>
            <Text style={styles.fpsText}>
              Haptics {showHapticsMenu ? '▼' : '▶'}
            </Text>
          </Pressable>

          {showHapticsMenu && (
            <View style={[styles.fpsMenu, { top: 90 }]}>
              {/* Drawing Haptic */}
              <View style={styles.hapticControl}>
                <Text style={styles.hapticLabel}>Drawing: {hapticsConfig.drawing.durationMs}ms / {hapticsConfig.drawing.intensity}</Text>
                <View style={styles.hapticButtons}>
                  <Pressable onPress={() => setHapticsConfig({...hapticsConfig, drawing: {...hapticsConfig.drawing, durationMs: Math.max(1, hapticsConfig.drawing.durationMs - 1)}})} style={styles.hapticBtn}>
                    <Text style={styles.hapticBtnText}>-ms</Text>
                  </Pressable>
                  <Pressable onPress={() => setHapticsConfig({...hapticsConfig, drawing: {...hapticsConfig.drawing, intensity: Math.max(1, hapticsConfig.drawing.intensity - 10)}})} style={styles.hapticBtn}>
                    <Text style={styles.hapticBtnText}>-pow</Text>
                  </Pressable>
                  <Pressable onPress={() => {
                    if (ReactNativeRichVibration) {
                      ReactNativeRichVibration.vibrate(hapticsConfig.drawing.durationMs, hapticsConfig.drawing.intensity);
                    }
                  }} style={styles.hapticTestBtn}>
                    <Text style={styles.hapticBtnText}>Test</Text>
                  </Pressable>
                  <Pressable onPress={() => setHapticsConfig({...hapticsConfig, drawing: {...hapticsConfig.drawing, intensity: Math.min(255, hapticsConfig.drawing.intensity + 10)}})} style={styles.hapticBtn}>
                    <Text style={styles.hapticBtnText}>+pow</Text>
                  </Pressable>
                  <Pressable onPress={() => setHapticsConfig({...hapticsConfig, drawing: {...hapticsConfig.drawing, durationMs: hapticsConfig.drawing.durationMs + 1}})} style={styles.hapticBtn}>
                    <Text style={styles.hapticBtnText}>+ms</Text>
                  </Pressable>
                </View>
              </View>

              {/* Gelato Creation Haptic */}
              <View style={styles.hapticControl}>
                <Text style={styles.hapticLabel}>Gelato Create: {hapticsConfig.gelatoCreation.durationMs}ms / {hapticsConfig.gelatoCreation.intensity}</Text>
                <View style={styles.hapticButtons}>
                  <Pressable onPress={() => setHapticsConfig({...hapticsConfig, gelatoCreation: {...hapticsConfig.gelatoCreation, durationMs: Math.max(1, hapticsConfig.gelatoCreation.durationMs - 1)}})} style={styles.hapticBtn}>
                    <Text style={styles.hapticBtnText}>-ms</Text>
                  </Pressable>
                  <Pressable onPress={() => setHapticsConfig({...hapticsConfig, gelatoCreation: {...hapticsConfig.gelatoCreation, intensity: Math.max(1, hapticsConfig.gelatoCreation.intensity - 10)}})} style={styles.hapticBtn}>
                    <Text style={styles.hapticBtnText}>-pow</Text>
                  </Pressable>
                  <Pressable onPress={() => {
                    if (ReactNativeRichVibration) {
                      ReactNativeRichVibration.vibrate(hapticsConfig.gelatoCreation.durationMs, hapticsConfig.gelatoCreation.intensity);
                    }
                  }} style={styles.hapticTestBtn}>
                    <Text style={styles.hapticBtnText}>Test</Text>
                  </Pressable>
                  <Pressable onPress={() => setHapticsConfig({...hapticsConfig, gelatoCreation: {...hapticsConfig.gelatoCreation, intensity: Math.min(255, hapticsConfig.gelatoCreation.intensity + 10)}})} style={styles.hapticBtn}>
                    <Text style={styles.hapticBtnText}>+pow</Text>
                  </Pressable>
                  <Pressable onPress={() => setHapticsConfig({...hapticsConfig, gelatoCreation: {...hapticsConfig.gelatoCreation, durationMs: hapticsConfig.gelatoCreation.durationMs + 1}})} style={styles.hapticBtn}>
                    <Text style={styles.hapticBtnText}>+ms</Text>
                  </Pressable>
                </View>
              </View>

              {/* Gelato Bounce Haptic */}
              <View style={styles.hapticControl}>
                <Text style={styles.hapticLabel}>Gelato Bounce: {hapticsConfig.gelatoBounce.durationMs}ms / {hapticsConfig.gelatoBounce.intensity}</Text>
                <View style={styles.hapticButtons}>
                  <Pressable onPress={() => setHapticsConfig({...hapticsConfig, gelatoBounce: {...hapticsConfig.gelatoBounce, durationMs: Math.max(1, hapticsConfig.gelatoBounce.durationMs - 1)}})} style={styles.hapticBtn}>
                    <Text style={styles.hapticBtnText}>-ms</Text>
                  </Pressable>
                  <Pressable onPress={() => setHapticsConfig({...hapticsConfig, gelatoBounce: {...hapticsConfig.gelatoBounce, intensity: Math.max(1, hapticsConfig.gelatoBounce.intensity - 10)}})} style={styles.hapticBtn}>
                    <Text style={styles.hapticBtnText}>-pow</Text>
                  </Pressable>
                  <Pressable onPress={() => {
                    if (ReactNativeRichVibration) {
                      ReactNativeRichVibration.vibrate(hapticsConfig.gelatoBounce.durationMs, hapticsConfig.gelatoBounce.intensity);
                    }
                  }} style={styles.hapticTestBtn}>
                    <Text style={styles.hapticBtnText}>Test</Text>
                  </Pressable>
                  <Pressable onPress={() => setHapticsConfig({...hapticsConfig, gelatoBounce: {...hapticsConfig.gelatoBounce, intensity: Math.min(255, hapticsConfig.gelatoBounce.intensity + 10)}})} style={styles.hapticBtn}>
                    <Text style={styles.hapticBtnText}>+pow</Text>
                  </Pressable>
                  <Pressable onPress={() => setHapticsConfig({...hapticsConfig, gelatoBounce: {...hapticsConfig.gelatoBounce, durationMs: hapticsConfig.gelatoBounce.durationMs + 1}})} style={styles.hapticBtn}>
                    <Text style={styles.hapticBtnText}>+ms</Text>
                  </Pressable>
                </View>
              </View>

              {/* Wall Bump Haptic */}
              <View style={styles.hapticControl}>
                <Text style={styles.hapticLabel}>Wall Bump: {hapticsConfig.wallBump.durationMs}ms / {hapticsConfig.wallBump.intensity}</Text>
                <View style={styles.hapticButtons}>
                  <Pressable onPress={() => setHapticsConfig({...hapticsConfig, wallBump: {...hapticsConfig.wallBump, durationMs: Math.max(1, hapticsConfig.wallBump.durationMs - 1)}})} style={styles.hapticBtn}>
                    <Text style={styles.hapticBtnText}>-ms</Text>
                  </Pressable>
                  <Pressable onPress={() => setHapticsConfig({...hapticsConfig, wallBump: {...hapticsConfig.wallBump, intensity: Math.max(1, hapticsConfig.wallBump.intensity - 10)}})} style={styles.hapticBtn}>
                    <Text style={styles.hapticBtnText}>-pow</Text>
                  </Pressable>
                  <Pressable onPress={() => {
                    if (ReactNativeRichVibration) {
                      ReactNativeRichVibration.vibrate(hapticsConfig.wallBump.durationMs, hapticsConfig.wallBump.intensity);
                    }
                  }} style={styles.hapticTestBtn}>
                    <Text style={styles.hapticBtnText}>Test</Text>
                  </Pressable>
                  <Pressable onPress={() => setHapticsConfig({...hapticsConfig, wallBump: {...hapticsConfig.wallBump, intensity: Math.min(255, hapticsConfig.wallBump.intensity + 10)}})} style={styles.hapticBtn}>
                    <Text style={styles.hapticBtnText}>+pow</Text>
                  </Pressable>
                  <Pressable onPress={() => setHapticsConfig({...hapticsConfig, wallBump: {...hapticsConfig.wallBump, durationMs: hapticsConfig.wallBump.durationMs + 1}})} style={styles.hapticBtn}>
                    <Text style={styles.hapticBtnText}>+ms</Text>
                  </Pressable>
                </View>
              </View>

              {/* Loss Haptic */}
              <View style={styles.hapticControl}>
                <Text style={styles.hapticLabel}>Loss: {hapticsConfig.loss.durationMs}ms / {hapticsConfig.loss.intensity}</Text>
                <View style={styles.hapticButtons}>
                  <Pressable onPress={() => setHapticsConfig({...hapticsConfig, loss: {...hapticsConfig.loss, durationMs: Math.max(1, hapticsConfig.loss.durationMs - 1)}})} style={styles.hapticBtn}>
                    <Text style={styles.hapticBtnText}>-ms</Text>
                  </Pressable>
                  <Pressable onPress={() => setHapticsConfig({...hapticsConfig, loss: {...hapticsConfig.loss, intensity: Math.max(1, hapticsConfig.loss.intensity - 10)}})} style={styles.hapticBtn}>
                    <Text style={styles.hapticBtnText}>-pow</Text>
                  </Pressable>
                  <Pressable onPress={() => {
                    if (ReactNativeRichVibration) {
                      ReactNativeRichVibration.vibrate(hapticsConfig.loss.durationMs, hapticsConfig.loss.intensity);
                    }
                  }} style={styles.hapticTestBtn}>
                    <Text style={styles.hapticBtnText}>Test</Text>
                  </Pressable>
                  <Pressable onPress={() => setHapticsConfig({...hapticsConfig, loss: {...hapticsConfig.loss, intensity: Math.min(255, hapticsConfig.loss.intensity + 10)}})} style={styles.hapticBtn}>
                    <Text style={styles.hapticBtnText}>+pow</Text>
                  </Pressable>
                  <Pressable onPress={() => setHapticsConfig({...hapticsConfig, loss: {...hapticsConfig.loss, durationMs: hapticsConfig.loss.durationMs + 1}})} style={styles.hapticBtn}>
                    <Text style={styles.hapticBtnText}>+ms</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
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
    backgroundColor: '#000000',
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
  fpsCounter: {
    position: 'absolute',
    top: 50,
    left: 50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1000,
  },
  fpsText: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#00ff00',
    fontWeight: 'bold',
  },
  fpsMenu: {
    position: 'absolute',
    top: 90,
    left: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 8,
    padding: 8,
    zIndex: 1000,
  },
  fpsButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    marginBottom: 4,
  },
  fpsButtonActive: {
    backgroundColor: 'rgba(0, 255, 0, 0.2)',
  },
  fpsButtonText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  hapticControl: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
  },
  hapticLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#00ff00',
    marginBottom: 6,
    fontWeight: 'bold',
  },
  hapticButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  hapticBtn: {
    flex: 1,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    alignItems: 'center',
  },
  hapticTestBtn: {
    flex: 2,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 255, 0, 0.2)',
    borderRadius: 4,
    alignItems: 'center',
  },
  hapticBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
