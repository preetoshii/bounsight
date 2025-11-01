import { useEffect, useRef, useState } from 'react';
import { GameCore } from '../core/GameCore';

/**
 * IMPORTANT: This hook contains the canonical game loop logic.
 * Any physics changes should be made here first, then GameApp should be updated to match.
 * This ensures PreviewMode and main game stay in perfect sync.
 */

/**
 * useGameLoop - Shared game loop logic for main game and preview mode
 * Ensures consistent physics behavior across all game instances
 *
 * @param {Object} dimensions - { width, height }
 * @param {string|null} customMessage - Optional custom message for preview mode
 * @param {string|null} audioUri - Optional audio URI for voice playback
 * @param {Array|null} wordTimings - Optional word timings for voice sync
 * @param {number|null} fpsCap - Optional FPS cap (null = uncapped)
 * @returns {Object} - Game state and refs for rendering
 */
export function useGameLoop(dimensions, customMessage = null, audioUri = null, wordTimings = null, wordAudioSegments = null, fpsCap = null) {
  const gameCore = useRef(null);
  const [, forceUpdate] = useState(0);

  // Game state refs
  const mascotPos = useRef({ x: dimensions.width / 2, y: 100 });
  const obstacles = useRef([]);
  const bounceImpact = useRef(null);
  const gelatoCreationTime = useRef(null);
  const currentWord = useRef(null);
  const mascotVelocityY = useRef(0);
  const squashStretch = useRef({ scaleX: 1, scaleY: 1 });
  const lastGelatoData = useRef(null);

  // Line drawing state
  const [lines, setLines] = useState([]);

  // Fixed timestep accumulator for framerate-independent physics
  const accumulator = useRef(0);
  const FIXED_TIMESTEP = 16.667; // 60 Hz physics updates (1000ms / 60 = 16.667ms)

  // Initialize game loop
  useEffect(() => {
    // Create GameCore instance
    gameCore.current = new GameCore(
      dimensions.width,
      dimensions.height,
      customMessage,
      audioUri,
      wordTimings,
      wordAudioSegments
    );

    let animationFrameId;
    let lastTime = performance.now();
    let lastFrameTime = performance.now(); // For FPS cap

    const animate = (currentTime) => {
      // FPS cap: Skip this frame if not enough time has passed
      const minFrameTime = fpsCap ? (1000 / fpsCap) : 0;
      if (fpsCap && (currentTime - lastFrameTime < minFrameTime)) {
        // Schedule next frame but skip work
        animationFrameId = requestAnimationFrame(animate);
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

      // Schedule next frame at the end
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (gameCore.current) {
        gameCore.current.destroy();
      }
    };
  }, [dimensions.width, dimensions.height, customMessage, audioUri, wordTimings, wordAudioSegments, fpsCap]);

  return {
    gameCore,
    mascotPos,
    obstacles,
    bounceImpact,
    gelatoCreationTime,
    currentWord,
    mascotVelocityY,
    squashStretch,
    lines,
    setLines,
  };
}
