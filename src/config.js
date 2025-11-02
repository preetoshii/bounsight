/**
 * Bounsight - Game Configuration
 * All tunable constants in one place for easy vibe-coding.
 * Values are TBD and exploratory - will emerge through playtesting.
 */

export const config = {
  // === AUDIO SYNC ===
  audio: {
    // Trim this many milliseconds from the start of each word slice
    // Google's timestamps may include leading silence/breath sounds
    // Increase if audio plays too early, decrease if too late
    trimStartMs: 120, // Try values between 50-150ms
  },

  // === PHYSICS ===
  physics: {
    gravityY: 1.0,            // Gravity strength (0.5 = floaty, 2.0 = heavy)

    // Mascot (ball) physics properties
    mascot: {
      radius: 30,             // Ball radius in pixels
      restitution: 0.6,       // Bounciness on collision (0 = no bounce, 1 = perfect bounce)
      friction: 0.01,         // Surface friction when sliding (0 = frictionless, 1 = sticky)
      frictionAir: 0.005,     // Air resistance affecting terminal velocity (lower = falls faster)
      mass: 1,                // Mass affects force calculations (default: 1)
    },

    // Entrance animation (ball dropping from top)
    entrance: {
      delayMs: 1000,          // Delay before entrance animation starts (in milliseconds)
      durationMs: 800,        // Duration of entrance animation (in milliseconds)
    },

    // Idle floating animation (before game starts)
    idleFloat: {
      amplitude: 8,           // Vertical movement range in pixels (up/down from center)
      speed: 0.5,             // Cycles per second (lower = slower, more meditative)
    },

    // Velocity limits (safety valve to prevent extreme speeds)
    maxVelocityX: 30,         // Maximum horizontal velocity in pixels/frame
    maxVelocityY: 50,         // Maximum vertical velocity in pixels/frame
  },

  // === DIFFICULTY PROGRESSION ===
  difficulty: {
    enabled: true,            // Toggle difficulty ramping on/off

    // Friction air progression (controls fall speed)
    frictionAir: {
      start: 0.005,           // Starting air resistance (easy - slower falls)
      end: 0.0005,            // Ending air resistance (hard - faster falls)
      bouncesUntilMax: 30,    // Number of bounces to reach maximum difficulty
    },

    // Formula: Linear interpolation between start and end
    // frictionAir = start - ((start - end) * (bounces / bouncesUntilMax))
    // Example with defaults:
    //   Bounce 0:  frictionAir = 0.005
    //   Bounce 10: frictionAir = 0.0035
    //   Bounce 20: frictionAir = 0.002
    //   Bounce 30+: frictionAir = 0.0005 (max difficulty)
  },

  // === GELATO (SPRINGBOARDS) ===
  gelato: {
    maxLength: 230,           // Maximum line length in pixels (enforced during drawing)
    thickness: 4,             // Visual line thickness in pixels
    springBoost: 1.25,        // Trampoline bounce multiplier (1.0 = normal physics, 1.75 = 175% bounce back)
    maxActiveGelatos: 1,      // How many Gelatos can exist simultaneously (currently: 1)
    color: '#FFFFFF',         // Line color (hex or rgba)

    // Visual deformation (trampoline effect on bounce)
    deformation: {
      maxBendAmount: 20,      // Maximum bend distance in pixels (higher = more dramatic wobble)
      duration: 400,          // Total animation duration in milliseconds
      frequency: 3,           // Oscillation speed (higher = faster/snappier, lower = slower/gooier)
      damping: 0.6,           // Spring damping coefficient (0 = no decay, 1 = heavy decay, uses exponential)
    },

    // Creation animation (pop-in effect when Gelato spawns)
    creation: {
      maxBendAmount: 15,      // Maximum bend in pixels when appearing (from center of line)
      duration: 300,          // How long the pop-in animation lasts in milliseconds
      frequency: 2,           // Oscillation speed (higher = faster wobble, lower = slower/gooier)
      damping: 0.5,           // Spring damping coefficient (lower = more bouncy, higher = settles faster)
    },

    // Destruction animation (fade-out on bounce)
    fadeOutDuration: 500,     // How long Gelato takes to fade out after bounce in milliseconds
  },

  // === BOUNCING ===
  bounce: {
    minIntervalMs: 100,       // Debounce timer in milliseconds to prevent double-bouncing on same Gelato
  },

  // === WALLS (Screen Boundaries) ===
  walls: {
    behavior: 'bounce',       // Boundary behavior: 'bounce' (reflect) or 'wrap' (teleport to other side)
    restitution: 0.8,         // Wall bounciness (0 = absorbs all energy, 0.5 = loses half, 1 = perfect bounce)
    thickness: 5,             // Thickness of boundary walls in pixels (affects physics collision edge)
    visible: false,           // Whether to render walls visually (false = invisible boundaries at screen edges)
  },

  // === HAPTICS (Mobile vibration feedback) ===
  // Platform-specific haptic feedback configuration
  //
  // Android: Custom expo-custom-haptics module using VibrationEffect.createOneShot()
  //   - durationMs: any positive number (e.g. 1-1000ms)
  //   - amplitude: 1-255 (1 = softest, 255 = strongest)
  //
  // iOS: expo-haptics with preset impact styles
  //   - style: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid'
  //   - iOS ignores Android settings, uses native haptic engine
  haptics: {
    gelatoCreation: {
      android: { durationMs: 0, amplitude: 0},   // Quick subtle tick
      ios: 'light',                                  // Light impact
    },
    gelatoBounce: {
      android: { durationMs: 5, amplitude: 40 },   // Very subtle for frequent bounces
      ios: 'soft',                                   // Soft impact
    },
    wallBump: {
      android: { durationMs: 0, amplitude: 0 },   // Medium subtle tick
      ios: 'light',                                  // Light impact
    },
    loss: {
      android: { durationMs: 50, amplitude: 100 },  // Longer, stronger for emphasis
    },

    // Drawing haptics (pencil-on-paper effect while dragging)
    drawing: {
      enabled: true,                                 // Enable/disable drawing haptics
      android: { durationMs: 1, amplitude: 20 },   // Ultra-subtle quick tick
      ios: 'soft',                                   // Soft impact
      pixelsPerTick: 20,                             // Distance between haptic ticks
      minIntervalMs: 50,                             // Minimum time between ticks (prevents overlap)
    },
  },

  // === AUDIO (Not yet implemented) ===
  audio: {
    voiceVolume: 1.0,         // Voice playback volume for word narration (0 = mute, 1 = full)
    sfxVolume: 0.3,           // Sound effects volume for bounces (0 = mute, 1 = full)
    duckingSfx: true,         // Whether to lower SFX volume when voice plays
  },

  // === VISUALS ===
  visuals: {
    backgroundColor: '#000000',   // Canvas background color (pure black)
    wordColor: '#FFFFFF',         // Text color for revealed words
    wordFontSize: 145,            // Font size for revealed words in pixels

    // Word fade mode: controls how words fade in/out after bounce
    // - 'velocity': Text opacity syncs 1:1 with ball's velocity change (physics-based, organic feel)
    //               Fades as ball rises and falls after bounce, tied to motion
    // - 'static': Traditional time-based fade with three configurable phases (fade-in, persist, fade-out)
    wordFadeMode: 'velocity',

    // Static fade timing (only used when wordFadeMode = 'static')
    // Creates a three-phase animation: fade-in → persist at full opacity → fade-out
    wordFadeInMs: 0,              // Phase 1: Fade-in duration from 0% → 100% opacity (0 = instant appearance)
    wordPersistMs: 800,           // Phase 2: How long word stays at 100% opacity before fading out
    wordFadeOutMs: 1500,          // Phase 3: Fade-out duration from 100% → 0% opacity
  },

  // === DRAWING ===
  drawing: {
    approach: 'continuous',       // Drawing method: 'continuous' (smooth path) or 'segmented' (snap to grid)

    // For segmented approach (not currently used)
    segmentTriggerDistance: 10,   // Distance in pixels finger must move before creating new segment

    // Preview visual (dotted line while drawing)
    previewColor: 'rgba(255, 255, 255, 0.5)',  // Preview line color with transparency
    previewThickness: 2,          // Preview line thickness in pixels (not currently used, uses gelato.thickness)
  },

  // === PERFORMANCE ===
  performance: {
    defaultFpsCap: null,          // Default FPS cap for components without their own FPS UI (null = uncapped, or 30/60/etc)
  },
};
