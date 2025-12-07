import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions, Pressable, Text, Animated, ActivityIndicator, Platform, BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { GameRenderer } from './GameRenderer';
import { GameCore } from './GameCore';
import { config, getResponsiveConfig } from '../../config';
import { AdminPortal } from '../admin-portal/AdminPortal';
import { playSound } from '../../shared/utils/audio';
import { fetchMessages } from '../../shared/services/githubApi';
import { startColorManager, getPrimaryColor } from '../../shared/services/primaryColorManager';
import { Button } from '../../shared/components/Button';
import { triggerDrawingHaptic, triggerHaptic } from '../../shared/utils/haptics';
import { DebugMenu } from '../../shared/components/DebugMenu';
import { logger } from '../../shared/utils/logger';
import { RadialProgressBar } from '../../shared/components/RadialProgressBar';
import { getProgress, setProgress, addProgress } from '../../shared/services/progressStorage';

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
  
  // Shared game state object - mutated directly in game loop
  // Only frame counter triggers minimal React re-render
  const gameState = useRef({
    mascotPos: { x: dimensions.width / 2, y: 100 },
    obstacles: [],
    bounceImpact: null,
    gelatoCreationTime: null,
    currentWord: null,
    mascotVelocityY: 0,
    mascotVelocityX: 0,
    mascotRadius: 45,
    parallaxStars: [],
    trails: [],
    primaryColor: '#FFFFFF',
    particles: [],
    wallGlows: [],
    deathFadeProgress: 0,
    deathStartTime: null,
    coinCountCutsceneActive: false,
    coinCountCutsceneStartTime: null,
    coins: [],
    coinCount: 0,
    progress: 0,
    animatedProgress: 0,
    displayedCoinCount: 0, // Coin count displayed during cutscene animation
    depositedCoins: 0, // Number of coins deposited during animation
    lastDepositTime: null, // Timestamp of last coin deposit
    cutsceneStartProgress: 0, // Stored progress when cutscene started (base for calculations)
    progressBarPulse: false, // Flag to trigger pulse animation on progress bar
    progressBarWasIdle: false, // Track if progress bar was in idle state
    progressBarWasGameplay: false, // Track if progress bar was in gameplay state
    progressBarIdleStartTime: null, // When we entered idle state
    progressBarGameplayStartTime: null, // When we entered gameplay state
    gameStarted: false,
    hasLost: false,
    // 3D sphere rotation state
    sphereRotation: { rotationX: 0, rotationY: 0, rotationZ: 0 },
    // Voice audio state for mouth animation
    isVoicePlaying: false,
  });
  
  // Frame counter for minimal React re-render trigger (just a number, not full reconciliation)
  const [frame, setFrame] = useState(0);
  
  // Progress animation state
  const progressAnimationRef = useRef(null);
  const cutsceneStartProgressRef = useRef(0);
  const cutsceneTargetProgressRef = useRef(0);
  const animatedProgressValue = useRef(new Animated.Value(0)).current;

  // Simple line drawing state (still uses React state since it changes infrequently)
  const [lines, setLines] = useState([]);
  const [currentPath, setCurrentPath] = useState(null); // Array of {x, y} points
  const lastGelatoData = useRef(null); // Track last gelato data to detect changes

  // Admin portal state
  const [showAdmin, setShowAdmin] = useState(false);
  const [preloadedMessagesData, setPreloadedMessagesData] = useState(null);
  const gameOpacity = useRef(new Animated.Value(1)).current;
  const adminOpacity = useRef(new Animated.Value(0)).current;

  // Remount counter - increment to force remount main game
  const [gameMountKey, setGameMountKey] = useState(0);

  // Black overlay for smooth fade-in
  const overlayOpacity = useRef(new Animated.Value(1)).current;

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
  const fpsCapRef = useRef(fpsCap); // Use ref to avoid remounting effect

  // Debug mode toggle (can be toggled with backslash key)
  const [debugMode, setDebugMode] = useState(config.debugMode);

  // Debug menu (DEV ONLY - only enabled when debugMode is true)
  const [showDebugMenu, setShowDebugMenu] = useState(false);
  const [showFps, setShowFps] = useState(debugMode && config.performance.showFps);
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

  // Sync fpsCap ref when state changes
  useEffect(() => {
    fpsCapRef.current = fpsCap;
  }, [fpsCap]);

  // Fade in overlay after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 500); // 500ms delay before fade starts

    return () => clearTimeout(timer);
  }, []);

  // Initialize color manager once on mount
  useEffect(() => {
    startColorManager();
  }, []);

  // Keyboard listener for debug mode toggle (backslash key)
  useEffect(() => {
    if (Platform.OS !== 'web') return; // Only on web

    const handleKeyDown = (e) => {
      if (e.key === '\\' || e.key === 'Backslash') {
        setDebugMode(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize physics once on mount
  useEffect(() => {
    // Calculate responsive config based on screen width
    const responsiveConfig = getResponsiveConfig(dimensions.width);
    
    // Initialize gameState with dimensions
    gameState.current.mascotPos = { x: dimensions.width / 2, y: 100 };
    
    // Initialize physics with current dimensions and responsive config
    gameCore.current = new GameCore(dimensions.width, dimensions.height, null, null, null, null, responsiveConfig);

    let lastTime = performance.now();
    let lastFrameTime = performance.now(); // For FPS cap

    const animate = (currentTime) => {
      // FPS cap: Skip this frame if not enough time has passed
      const currentFpsCap = fpsCapRef.current;
      const minFrameTime = currentFpsCap ? (1000 / currentFpsCap) : 0;
      if (currentFpsCap && (currentTime - lastFrameTime < minFrameTime)) {
        // Schedule next frame but skip work
        animationFrameId.current = requestAnimationFrame(animate);
        return;
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

      // Update shared game state directly (mutation - bypasses React reconciliation)
      // Only frame counter triggers minimal React state update
      const state = gameState.current;
      state.mascotPos = gameCore.current.getMascotPosition();
      state.obstacles = gameCore.current.getObstacles();
      state.bounceImpact = gameCore.current.getBounceImpact();
      state.gelatoCreationTime = gameCore.current.getGelatoCreationTime();
      state.currentWord = gameCore.current.getCurrentWord();
      state.mascotVelocityY = gameCore.current.getMascotVelocityY();
      state.mascotVelocityX = gameCore.current.getMascotVelocityX();
      state.mascotRadius = gameCore.current.getMascotRadius();
      state.parallaxStars = gameCore.current.getParallaxStars();
      const trailData = gameCore.current.getTrail();
      state.trails = trailData.trails;
      state.primaryColor = gameCore.current.getPrimaryColor();
      state.particles = gameCore.current.getParticles();
      state.wallGlows = gameCore.current.getWallGlows();
      state.bounceRipples = gameCore.current.getBounceRipples();
      state.lastBounceScale = gameCore.current.getLastBounceScale();
      state.deathFadeProgress = gameCore.current.getDeathFadeProgress();
      state.deathStartTime = gameCore.current.getDeathStartTime();
      state.coinCountCutsceneActive = gameCore.current.getCoinCountCutsceneActive();
      state.coinCountCutsceneStartTime = gameCore.current.getCoinCountCutsceneStartTime();
      state.coins = gameCore.current.getCoins();
      state.coinCount = gameCore.current.getCoinCount();
      state.progress = gameCore.current.getProgress();
      state.sphereRotation = gameCore.current.getSphereRotation();
      state.isVoicePlaying = gameCore.current.isVoicePlaying();
      
      // Handle coin deposit animation during cutscene
      if (state.coinCountCutsceneActive && state.coinCountCutsceneStartTime !== null) {
        const currentTime = Date.now();
        const depositInterval = config.progressBar.coinDepositIntervalMs;
        const startDelay = config.progressBar.coinDepositStartDelayMs;
        const timeSinceCutsceneStart = currentTime - state.coinCountCutsceneStartTime;
        
        // Initialize animation state on first frame of cutscene
        if (state.lastDepositTime === null) {
          state.displayedCoinCount = state.coinCount;
          state.depositedCoins = 0;
          // Store the initial progress when cutscene starts (this is our base)
          state.cutsceneStartProgress = state.progress;
          // Start animated progress from current stored progress
          state.animatedProgress = state.progress;
          animatedProgressValue.setValue(state.progress);
          // Set lastDepositTime to cutscene start + delay (so deposits start after delay)
          state.lastDepositTime = state.coinCountCutsceneStartTime + startDelay;
        }
        
        // Check if initial delay has passed and it's time for next deposit
        if (timeSinceCutsceneStart >= startDelay && state.displayedCoinCount > 0 && (currentTime - state.lastDepositTime) >= depositInterval) {
          // Deposit one coin
          state.displayedCoinCount--;
          state.depositedCoins++;
          
          // Play coin pickup sound
          playSound('pickup-coin');
          
          // Trigger pulse animation (will be read by RadialProgressBar)
          state.progressBarPulse = true;
          
          // Calculate new progress: initial stored progress + (deposited coins / coins per full bar)
          const progressPerCoin = 1 / config.progressBar.coinsPerFullBar;
          const newProgress = Math.min(1.0, state.cutsceneStartProgress + (state.depositedCoins * progressPerCoin));
          
          // Update animated progress immediately (so it shows incrementally)
          state.animatedProgress = newProgress;
          animatedProgressValue.setValue(newProgress);
          
          // Also animate smoothly to the new value for smooth transition
          Animated.timing(animatedProgressValue, {
            toValue: newProgress,
            duration: depositInterval, // Animate over the deposit interval
            useNativeDriver: false,
          }).start();
          
          // Update localStorage with this deposit
          addProgress(progressPerCoin);
          
          // Update stored progress in state (will be read from storage next frame)
          state.progress = newProgress;
          
          state.lastDepositTime = currentTime;
        } else {
          // Reset pulse flag after animation
          state.progressBarPulse = false;
        }
      } else {
        // Reset animation state when cutscene is not active
        state.displayedCoinCount = 0;
        state.depositedCoins = 0;
        state.lastDepositTime = null;
        state.cutsceneStartProgress = 0;
        
        // Reset progress bar fade tracking when game resets (returns to idle)
        if (!state.gameStarted && !state.hasLost) {
          // Game has reset to idle - reset fade tracking so it fades in again
          state.progressBarWasIdle = false;
          state.progressBarWasGameplay = false;
          state.progressBarIdleStartTime = null;
          state.progressBarGameplayStartTime = null;
        }
      }
      state.gameStarted = gameCore.current.getGameStarted();
      state.hasLost = gameCore.current.getHasLost();
      state.gelato = gameCore.current.getGelato(); // For debug visualization
      
      // Minimal React update - just a number, triggers Skia re-render without full reconciliation
      setFrame(prev => prev + 1);

      // Sync lines with GameCore (updates when gelato destroyed after fade)
      const currentGelatoData = gameCore.current.getGelatoLineData();
      if (currentGelatoData !== lastGelatoData.current) {
        lastGelatoData.current = currentGelatoData;
        setLines(currentGelatoData ? [currentGelatoData] : []);
      }

      // Only track FPS if debugMode is enabled
      if (debugMode) {
        fpsCounter.current.frames++;
        const now = performance.now();
        if (now >= fpsCounter.current.lastTime + 1000) {
          setFps(Math.round((fpsCounter.current.frames * 1000) / (now - fpsCounter.current.lastTime)));
          fpsCounter.current.frames = 0;
          fpsCounter.current.lastTime = now;
        }
      }

      // Schedule next frame at the end
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

  // Reset animation state when cutscene ends
  useEffect(() => {
    const cutsceneActive = gameState.current.coinCountCutsceneActive;
    if (!cutsceneActive) {
      // Reset animation state when cutscene ends
      gameState.current.displayedCoinCount = 0;
      gameState.current.depositedCoins = 0;
      gameState.current.lastDepositTime = null;
      gameState.current.cutsceneStartProgress = 0;
      // Reset animated value to current stored progress
      animatedProgressValue.setValue(gameState.current.progress);
    }
  }, [gameState.current.coinCountCutsceneActive]);

  // Update animated progress value in gameState
  useEffect(() => {
    const listener = animatedProgressValue.addListener(({ value }) => {
      gameState.current.animatedProgress = value;
      setFrame(prev => prev + 1); // Trigger re-render
    });
    
    return () => {
      animatedProgressValue.removeListener(listener);
    };
  }, []);

  // Pause/resume animation when admin portal opens/closes
  useEffect(() => {
    if (showAdmin) {
      // Delay pausing game until entrance animation completes (400ms)
      // This keeps the game visible and running while admin portal slides in
      const pauseDelay = setTimeout(() => {
        // Pause animation loop after entrance animation
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
          animationFrameId.current = null;
        }
        // Reset accumulator to prevent time buildup while paused
        accumulator.current = 0;
      }, 400); // Match AdminPortal entrance animation duration

      return () => clearTimeout(pauseDelay);
    } else {
      // Resume animation loop when admin closes (if not already running)
      if (!animationFrameId.current && gameCore.current) {
        let lastTime = performance.now();
        let lastFrameTime = performance.now();

        const animate = (currentTime) => {
          // FPS cap: Skip this frame if not enough time has passed
          const currentFpsCap = fpsCapRef.current;
          const minFrameTime = currentFpsCap ? (1000 / currentFpsCap) : 0;
          if (currentFpsCap && (currentTime - lastFrameTime < minFrameTime)) {
            // Schedule next frame but skip work
            animationFrameId.current = requestAnimationFrame(animate);
            return;
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

          // Update shared game state directly
          const state = gameState.current;
          state.mascotPos = gameCore.current.getMascotPosition();
          state.obstacles = gameCore.current.getObstacles();
          state.bounceImpact = gameCore.current.getBounceImpact();
          state.gelatoCreationTime = gameCore.current.getGelatoCreationTime();
          state.currentWord = gameCore.current.getCurrentWord();
          state.mascotVelocityY = gameCore.current.getMascotVelocityY();
          state.mascotVelocityX = gameCore.current.getMascotVelocityX();
          state.mascotRadius = gameCore.current.getMascotRadius();
          state.parallaxStars = gameCore.current.getParallaxStars();
          const trailData = gameCore.current.getTrail();
          state.trails = trailData.trails;
          // Read color from universal color manager (zero React overhead)
          state.primaryColor = getPrimaryColor();
          state.particles = gameCore.current.getParticles();
          state.wallGlows = gameCore.current.getWallGlows();
          state.bounceRipples = gameCore.current.getBounceRipples();
          state.lastBounceScale = gameCore.current.getLastBounceScale();
          state.deathFadeProgress = gameCore.current.getDeathFadeProgress();
          state.deathStartTime = gameCore.current.getDeathStartTime();
          state.coinCountCutsceneActive = gameCore.current.getCoinCountCutsceneActive();
          state.coinCountCutsceneStartTime = gameCore.current.getCoinCountCutsceneStartTime();
          state.coins = gameCore.current.getCoins();
          state.coinCount = gameCore.current.getCoinCount();
          state.progress = gameCore.current.getProgress();
          state.gameStarted = gameCore.current.getGameStarted();
          state.hasLost = gameCore.current.getHasLost();
          state.sphereRotation = gameCore.current.getSphereRotation();
          state.isVoicePlaying = gameCore.current.isVoicePlaying();
          
          setFrame(prev => prev + 1);

          const currentGelatoData = gameCore.current.getGelatoLineData();
          if (currentGelatoData !== lastGelatoData.current) {
            lastGelatoData.current = currentGelatoData;
            setLines(currentGelatoData ? [currentGelatoData] : []);
          }

          // Only track FPS if debugMode is enabled
          if (debugMode) {
            fpsCounter.current.frames++;
            const now = performance.now();
            if (now >= fpsCounter.current.lastTime + 1000) {
              setFps(Math.round((fpsCounter.current.frames * 1000) / (now - fpsCounter.current.lastTime)));
              fpsCounter.current.frames = 0;
              fpsCounter.current.lastTime = now;
            }
          }

          // Schedule next frame at the end
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
        // Recalculate responsive config for new screen size
        const responsiveConfig = getResponsiveConfig(newDimensions.width);
        gameCore.current.updateBoundaries(newDimensions.width, newDimensions.height, responsiveConfig);
      }
    });

    return () => subscription?.remove();
  }, []);

  /**
   * Prevent Android hardware back button from interfering with gameplay.
   * 
   * This complements the immersive mode in MainActivity.kt which blocks edge-swipe gestures.
   * The hardware back button is still accessible, so we intercept it here to prevent
   * accidental exits during gameplay. The admin portal can still use the back button normally.
   * 
   * Note: iOS edge swipe prevention is handled natively in GameViewController.swift
   * which defers system gestures on all screen edges using preferredScreenEdgesDeferringSystemGestures.
   */
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        // Only allow back if admin portal is open (let it handle its own navigation)
        if (showAdmin) {
          return false; // Let admin portal handle back button
        }
        // Prevent back button during gameplay to avoid accidental exits
        return true; // Prevent default back behavior
      });

      return () => backHandler.remove();
    }
  }, [showAdmin]);

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
    logger.log('TOUCH_INPUT', '🎨 Touch start:', touch.pageX, touch.pageY);
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
    // Use responsive max length from gameCore
    const maxLength = gameCore.current ? gameCore.current.getGelatoMaxLength() : config.gelato.maxLength;
    const trimmedPath = trimPathToMaxLength(newPath, maxLength);

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
        // Trigger ultra-subtle haptic for drawing feedback
        // Uses platform-specific haptics (Android: custom module, iOS: expo-haptics)
        triggerDrawingHaptic(hapticsConfig);
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
        endPoint.y,
        currentPath // Pass the full drawn path for morphing animation
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
      logger.error('INITIALIZATION', 'Failed to preload messages:', error);
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
      {/* Game view - always mounted and visible (admin portal overlays on top) */}
      <View
        key={gameMountKey}
        style={styles.fullScreen}
        onStartShouldSetResponder={() => true}
        onResponderGrant={handleTouchStart}
        onResponderMove={handleTouchMove}
        onResponderRelease={handleTouchEnd}
      >
        {/* Hidden preload element to force font to load before first word */}
        <Text style={{ position: 'absolute', opacity: 0, fontFamily: 'FinlandRounded' }}>
          preload
        </Text>

        <GameRenderer
          width={dimensions.width}
          height={dimensions.height}
          gameState={gameState.current}
          frame={frame}
          lines={lines}
          currentPath={currentPath}
          debugMode={debugMode}
        />

        {/* Admin Button - Feather Icon */}
        <Pressable onPress={openAdmin} style={styles.adminButton}>
          <Feather name="feather" size={20} color={gameState.current.primaryColor} style={{ opacity: 0.6 }} />
        </Pressable>

        {/* Debug Mode Indicator Frame */}
        {debugMode && (
          <View style={styles.debugFrame} pointerEvents="none">
            <Text style={styles.debugLabel}>DEBUG</Text>
          </View>
        )}

        {/* Debug Button (only visible when debugMode is enabled) */}
        {debugMode && (
          <>
            <Pressable onPress={() => setShowDebugMenu(true)} style={styles.debugButton}>
              <Text style={[styles.debugButtonText, { color: gameState.current.primaryColor }]}>
                {config.performance.showFps ? `⚙️ ${fps} FPS` : '⚙️'}
              </Text>
            </Pressable>

            {/* Debug Menu Overlay */}
            <DebugMenu
              visible={showDebugMenu}
              onClose={() => setShowDebugMenu(false)}
              hapticsConfig={hapticsConfig}
              setHapticsConfig={setHapticsConfig}
              fpsCap={fpsCap}
              setFpsCap={setFpsCap}
              showFps={showFps}
              setShowFps={setShowFps}
              primaryColor={gameState.current.primaryColor}
              onAddCoin={() => {
                if (gameCore.current) {
                  gameCore.current.addDebugCoin();
                }
              }}
              onResetProgress={() => {
                setProgress(0);
                // Force update to reflect the change
                gameState.current.progress = 0;
                gameState.current.animatedProgress = 0;
                animatedProgressValue.setValue(0);
              }}
            />
          </>
        )}
      </View>

      {/* Admin portal - overlay on top of game */}
      {showAdmin && (
        <View style={[styles.fullScreen, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}>
          <AdminPortal 
            onClose={closeAdmin} 
            preloadedData={preloadedMessagesData} 
            primaryColor={gameState.current.primaryColor}
            getPrimaryColor={() => gameState.current.primaryColor}
          />
        </View>
      )}

      {/* Progress Bar - visible only during cutscene (idle removed for now) */}
      {config.progressBar.enabled && (() => {
        const isCutscene = gameState.current.coinCountCutsceneActive;
        
        // Only show during cutscene, not during idle
        if (!isCutscene) return null;
        
        const state = gameState.current;
        const currentTime = Date.now();
        const fadeDurationMs = config.progressBar.fadeDurationMs;
        
        // Determine position (cutscene only)
        const position = config.progressBar.cutscenePosition;
        
        // Calculate opacity (fade in/out smoothly during cutscene)
        let opacity = 0;
        const cutsceneStartTime = state.coinCountCutsceneStartTime;
        if (cutsceneStartTime) {
          const timeSinceStart = currentTime - cutsceneStartTime;
          // Fade in at start of cutscene
          const fadeInProgress = Math.min(1, timeSinceStart / fadeDurationMs);
          
          // Fade out at end of cutscene
          const cutsceneDuration = config.coins.deathScreen.cutsceneDurationMs;
          const timeUntilEnd = cutsceneDuration - timeSinceStart;
          const fadeOutProgress = timeUntilEnd <= fadeDurationMs 
            ? Math.max(0, timeUntilEnd / fadeDurationMs)
            : 1;
          
          // Combine both fades
          opacity = Math.min(fadeInProgress, fadeOutProgress);
        }
        
        // Don't render if opacity is 0 (or very close to 0)
        if (opacity < 0.01) return null;
        
        // Use animated progress during cutscene
        const progress = state.animatedProgress;
        
        // Calculate position styles
        const positionStyle = {
          position: 'absolute',
        };
        
        // Handle positioning (can be number or percentage string)
        if (position.left !== undefined) {
          if (typeof position.left === 'string') {
            positionStyle.left = position.left;
          } else {
            positionStyle.left = position.left;
          }
        }
        if (position.right !== undefined) {
          if (typeof position.right === 'string') {
            positionStyle.right = position.right;
          } else {
            positionStyle.right = position.right;
          }
        }
        
        // Handle top position (can be number or percentage string)
        if (typeof position.top === 'string') {
          positionStyle.top = position.top;
        } else {
          positionStyle.top = position.top;
        }
        
        // Apply transform if provided
        if (position.transform) {
          positionStyle.transform = position.transform;
        }
        
        // Show coin count in center during cutscene, not during idle
        const showCoinCount = isCutscene;
        // During cutscene, always use displayedCoinCount (starts at session count, decrements to 0)
        const coinCount = showCoinCount 
          ? gameState.current.displayedCoinCount
          : null;
        
        return (
          <View style={positionStyle}>
            <RadialProgressBar
              progress={progress}
              size={config.progressBar.size}
              strokeWidth={config.progressBar.strokeWidth}
              color={gameState.current.primaryColor}
              opacity={opacity}
              coinCount={coinCount}
              coinCountFontSize={config.coins.deathScreen.fontSize}
              shouldPulse={gameState.current.progressBarPulse}
            />
          </View>
        );
      })()}

      {/* Hide status bar - immersive mode in MainActivity.kt handles system-level hiding,
          but this ensures React Native doesn't show it either */}
      <StatusBar hidden={true} />

      {/* Black overlay that fades in on mount */}
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: overlayOpacity,
          },
        ]}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 9999,
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
    left: 50,
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
  debugButton: {
    position: 'absolute',
    top: 50,
    left: 50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1000,
  },
  debugFrame: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderWidth: 2,
    borderColor: '#ff0000',
    borderRadius: 4,
    zIndex: 999,
  },
  debugLabel: {
    position: 'absolute',
    top: 15,
    right: 15,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 10,
    color: '#ff0000',
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  debugButtonText: {
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
    // backgroundColor set inline with primaryColor (with opacity)
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
