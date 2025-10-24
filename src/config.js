/**
 * Bounsight - Game Configuration
 * All tunable constants in one place for easy vibe-coding.
 * Values are TBD and exploratory - will emerge through playtesting.
 */

export const config = {
  // === PHYSICS ===
  physics: {
    // Gravity strength (0.5 = floaty, 2.0 = heavy)
    gravityY: 1.0,

    // Mascot physics properties
    mascot: {
      radius: 30,
      restitution: 0.6,      // Bounciness (0-1)
      friction: 0.01,         // Surface friction
      frictionAir: 0.02,      // Air resistance (0.01 = slippery, 0.05 = dampened)
      mass: 1,
    },

    // Velocity limits (safety valve)
    maxVelocityX: 20,
    maxVelocityY: 30,
  },

  // === GELATO (SPRINGBOARDS) ===
  gelato: {
    maxLength: 150,           // Maximum distance between start and end points
    thickness: 4,             // Visual thickness of the line
    springBoost: 0.05,        // Additional impulse force on bounce (added to restitution)
    maxActiveGelatos: 1,      // How many can exist at once
    color: '#FFFFFF',
  },

  // === BOUNCING ===
  bounce: {
    minIntervalMs: 100,       // Debounce timer to prevent double-bouncing
  },

  // === WALLS ===
  walls: {
    behavior: 'bounce',       // 'bounce' or 'wrap'
    restitution: 0.5,         // Wall bounciness (if behavior is 'bounce')
  },

  // === HAPTICS ===
  haptics: {
    gelatoPlaced: 'light',    // Haptic when drawing a line
    bounce: 'medium',         // Haptic on bounce/word reveal
    combo: 'success',         // Haptic for tall combo (optional feature)
  },

  // === AUDIO ===
  audio: {
    voiceVolume: 1.0,         // Voice playback volume (0-1)
    sfxVolume: 0.3,           // Bounce SFX volume (0-1)
    duckingSfx: true,         // Lower SFX when voice plays
  },

  // === VISUALS ===
  visuals: {
    backgroundColor: '#0a0a0a',   // Dark mode background
    wordColor: '#FFFFFF',
    wordFontSize: 32,
    wordFadeMs: 1500,             // How long word stays on screen
  },

  // === DRAWING ===
  drawing: {
    // Approach: 'continuous' or 'segmented' (TBD through experimentation)
    approach: 'continuous',

    // For segmented approach
    segmentTriggerDistance: 10,   // Distance finger moves before printing new segment

    // Preview visual
    previewColor: 'rgba(255, 255, 255, 0.5)',
    previewThickness: 2,
  },
};
