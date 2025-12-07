/**
 * Spherical Truth Machine - Game Configuration
 * All tunable constants in one place for easy vibe-coding.
 * Values are TBD and exploratory - will emerge through playtesting.
 */

/**
 * Calculate responsive size based on screen width
 * Uses linear interpolation between mobile and desktop reference sizes
 * This ensures the game feels right on both mobile and desktop
 * @param {number} screenWidth - Current screen width in pixels
 * @param {number} mobileSize - Size at mobile reference width (375px)
 * @param {number} desktopSize - Size at desktop reference width (1920px)
 * @returns {number} - Scaled size
 */
export function getResponsiveSize(screenWidth, mobileSize, desktopSize) {
  const mobileRef = 375;  // iPhone standard width
  const desktopRef = 1920; // Common desktop width
  
  // Clamp screen width to reasonable bounds
  const clampedWidth = Math.max(320, Math.min(screenWidth, 2560));
  
  // Linear interpolation
  if (clampedWidth <= mobileRef) {
    return mobileSize;
  } else if (clampedWidth >= desktopRef) {
    return desktopSize;
  } else {
    // Interpolate between mobile and desktop
    const ratio = (clampedWidth - mobileRef) / (desktopRef - mobileRef);
    return mobileSize + (desktopSize - mobileSize) * ratio;
  }
}

/**
 * Get responsive config values based on screen width
 * Returns mascot radius and gelato maxLength that scale appropriately
 * Compatible with existing resize system - walls already scale with dimensions
 * @param {number} screenWidth - Current screen width in pixels
 * @returns {Object} - { mascotRadius, gelatoMaxLength }
 */
export function getResponsiveConfig(screenWidth) {
  // Mobile (375px): radius 30, maxLength ~200 (user says 275 feels too long on mobile)
  // Desktop (1920px): radius 45, maxLength should scale proportionally with ball
  // Scale gelato proportionally to ball radius to maintain consistent feel
  const mascotRadius = getResponsiveSize(screenWidth, 30, 45);
  const radiusScale = mascotRadius / 30; // Scale factor relative to mobile (1.0 on mobile, 1.5 on desktop)
  
  // Scale gelato proportionally to ball: base 200 * scale factor
  // This ensures gelato feels right relative to ball size at all screen sizes
  // Mobile: 200, Desktop: 200 * 1.5 = 300
  const gelatoMaxLength = 200 * radiusScale;
  
  return {
    mascotRadius,
    gelatoMaxLength: Math.round(gelatoMaxLength),
  };
}

export const config = {
  // === AUDIO ===
  audio: {
    // Audio sync/trimming
    trimStartMs: 150,         // Trim this many milliseconds from the start of each word slice
                              // Google's timestamps may include leading silence/breath sounds
                              // Increase if audio plays too early, decrease if too late
                              // Try values between 50-150ms
    
    // Volume controls
    voiceVolume: 0.1,         // Voice playback volume for word narration (0 = mute, 1 = full, default: 0.5 = 50%)
    sfxVolume: 0.5,           // Sound effects volume for bounces (0 = mute, 1 = full)
    duckingSfx: false,         // Whether to lower SFX volume when voice plays
  },

  // === PHYSICS ===
  physics: {
    gravityY: 1.0,            // Gravity strength (0.5 = floaty, 2.0 = heavy)

    // Mascot (ball) physics properties
    mascot: {
      radius: 45,             // Ball radius in pixels (1.5x larger for better face visibility)
      restitution: 0.6,       // Bounciness on collision with walls (0 = no bounce, 1 = perfect bounce)
      friction: 0.01,         // Surface friction when sliding (0 = frictionless, 1 = sticky)
      frictionAir: 0.005,     // Air resistance affecting terminal velocity (lower = falls faster)
      mass: 1,                // Mass affects force calculations (default: 1)
      
      // Face (eyes and mouth) - legacy 2D face
      face: {
        enabled: false,        // Show 2D face on ball (disable when using sphere3D)
        eyeSize: 3,            // Eye radius
        eyeSpacing: 14,        // Distance between eyes
        eyeOffsetY: -6,        // Eyes Y position (negative = above center)
        mouthWidth: 14,        // Mouth width
        mouthHeight: 6,        // Mouth height (for smile curve)
        mouthOffsetY: 8,       // Mouth Y position (positive = below center)
      },
      
      // 3D Sphere effect - face wrapped around rotating sphere
      sphere3D: {
        enabled: true,         // Enable 3D rotating face (disable flat face when using this)
        
        // Face rendering options
        faceOpacity: 0.9,      // Opacity of face features (0.0 - 1.0)
        faceStrokeWidth: 2.5,  // Thickness of face feature lines
        
        // Rotation limits (keeps face mostly visible)
        maxRotationX: 0.4,     // Max tilt forward/back in radians (~23 degrees)
        maxRotationY: 0.5,     // Max spin left/right in radians (~29 degrees)
        maxRotationZ: 0.25,    // Max roll clockwise/counter-clockwise in radians (~14 degrees)
        
        // Position-based rotation: face looks toward where ball is on screen
        // Ball on left side = face looks left, ball on right = face looks right
        positionInfluence: 0.6, // How much position affects rotation (0 = none, 1 = full)
        
        // Return to center (for vertical tilt only, horizontal follows position)
        returnToCenter: {
          enabled: true,       // Enable return-to-center spring
          strength: 0.08,      // How strongly it pulls back (higher = snappier)
        },
        
        // Bounce impulse - rotation on gelato/wall impact
        bounceImpulse: {
          enabled: true,       // Add rotation impulse on bounce
          strength: 0.15,      // Impulse strength (subtle)
          decay: 0.85,         // Quick decay (0.85 = 15% decay per frame)
        },
        
        // Idle animation - gentle wobble instead of continuous spin
        idleWobble: {
          enabled: true,       // Gentle idle wobble
          amplitudeY: 0.1,     // Wobble amount (radians)
          speed: 0.5,          // Wobble speed (cycles per second)
        },
        
        // Mouth animation settings (for speaking)
        mouth: {
          closedHeight: 0.06,  // Height when closed (thicker = more visible line)
          openHeight: 0.18,    // Height when fully open
          width: 0.32,         // Horizontal width of mouth
          oscillationHz: 2,    // How fast mouth opens/closes when speaking (cycles per second)
          centerY: 0.38,       // Vertical position on face (0 = center, positive = lower)
        },
      },
      
      // Motion trail effect
      trail: {
        enabled: true,        // Enable/disable trail effect
        fadeOutMs: 5000,       // How long trail takes to fade out (milliseconds)
        sampleInterval: 16,   // Add trail point every N milliseconds (16ms = ~60fps sampling)
        maxPoints: 500,        // Maximum trail points to keep (prevents infinite growth)
        activeAfterBounceMs: 10,  // Trail visible for X ms after hitting gelato (0 = always on)
        endFadeDurationMs: 1800,     // Duration of fade-out when trail expires (0 = instant disappear)
        maxOpacity: 0.25,      // Maximum trail opacity (0.0 = invisible, 1.0 = solid)
        gradientLayers: 1,    // Number of overlapping layers for gradient effect (more = smoother fade)
      },

      // Ground glow (emanates from below screen edge)
      glow: {
        enabled: true,        // Toggle glow on/off
        yPosition: 1.02,      // Glow Y position as fraction of screen height (1.02 = slightly below screen)
        opacity: 0.7,         // Glow opacity (0.0 = invisible, 1.0 = solid)
        scaleX: 3.0,          // Horizontal scale multiplier (3.0 = 3x wider than ball)
        scaleY: 0.7,          // Vertical scale multiplier (0.7 = squished to 70% height)
        blur: 30,             // Blur radius in pixels (higher = softer glow)
        pulseSpeed: 2.0,      // Pulsation speed (seconds per cycle)
        pulseAmount: 0.35,    // Pulsation amount (0.35 = 35% variation in opacity)
        heightFadeStart: 0.0, // Start fading at top of screen (0% down)
        heightFadeEnd: 0.75,  // Full opacity at 75% down screen
      },

      // Angle quantization (snap ball trajectory to discrete directions)
      angleQuantization: {
        enabled: true,           // Toggle for easy testing
        numDirections: 32,       // Number of discrete angles (32 = 11.25° steps, 16 = 22.5°, 8 = 45°)
        preventStraightUp: true, // Rotate angle grid so 90° is never allowed (prevents easy or awkward straight-up bouncing)
      },

      // Gelato bounce juice (visual feedback on bounce)
      bounceJuice: {
        // Radial ripple effect
        ripple: {
          enabled: true,          // Toggle ripple effect
          duration: 1000,          // How long ripple expands (ms)
          maxRadius: 200,          // Maximum ripple radius (pixels from mascot center)
          opacity: 0.5,           // Starting opacity
          strokeWidth: 3,         // Ripple line thickness
        },
        // Mascot scale pulse
        scale: {
          enabled: true,          // Toggle scale pulse
          amount: 1.1,            // Scale multiplier (1.3 = 30% larger)
          duration: 150,          // Duration of scale animation (ms)
        },
      },
    },

    // Entrance animation (ball dropping from top)
    entrance: {
      delayMs: 1000,          // Delay before entrance animation starts (in milliseconds)
      durationMs: 800,        // Duration of entrance animation (in milliseconds)
    },

    // Death fade-out animation (when player loses)
    death: {
      fadeOutMs: 600,         // Duration of fade-out when player dies (milliseconds)
      delayBeforeResetMs: 0, // Delay after fade completes before resetting scene (milliseconds)
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

    // Time dilation approach: Scale physics simulation speed
    // Instead of changing individual physics parameters, we make time pass faster
    // This creates a natural "fast-forward" effect where everything speeds up proportionally
    //
    // Implementation: Multiply delta time passed to Matter.Engine.update()
    //   - All physics (gravity, velocity, collisions) speed up together
    //   - Bounce heights, trajectories, everything stays proportional
    //   - Pure speed increase without changing game feel
    speed: {
      start: .7,            // Starting time multiplier (1.0 = normal time)
      end: 1.7,              // Ending time multiplier (2.0 = 2x speed, like fast-forward)
      bouncesUntilMax: 30,   // Number of bounces to reach maximum difficulty
    },

    // Example progression:
    //   Bounce 0:  timeScale = 1.0  →  normal speed
    //   Bounce 10: timeScale = 1.33 →  33% faster
    //   Bounce 20: timeScale = 1.67 →  67% faster
    //   Bounce 30+: timeScale = 2.0  →  2x speed (everything runs at double speed)
  },

  // === GELATO (SPRINGBOARDS) ===
  gelato: {
    maxLength: 300,           // Maximum line length in pixels (fallback, actual value is responsive)
    thickness: 4,             // Visual line thickness in pixels
    previewThickness: 6,      // Preview dots thickness (separate from actual gelato)
    springBoost: 1.25,        // Trampoline bounce multiplier (1.0 = normal physics, 1.25 = 125% bounce back)
    maxActiveGelatos: 1,      // How many Gelatos can exist simultaneously (currently: 1)
    color: '#FFFFFF',         // Line color (hex or rgba)
    
    // Visual rendering mode
    renderMode: 'curved',     // 'curved' = honor drawn shape (with blend), 'straight' = simple A→B line
    curveBlend: .5,          // How much to honor drawn shape (0.0 = straight line, 1.0 = exact drawing, 0.5 = 50/50)
    collisionShape: 'path',   // 'line' = straight A→B physics, 'path' = curved physics matching blended visual

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
    
    // Morphing animation (drawn path → straight line transition)
    morphing: {
      enabled: true,          // Enable/disable shape morphing animation
      duration: 400,          // Animation duration in milliseconds (quick/snappy)
      frequency: 2.5,         // Oscillation frequency (higher = more bouncy)
      damping: 0.6,           // Spring damping (how quickly it settles)
    },

    // Collision forgiveness (makes Gelato easier to hit)
    forgiveness: {
      extensionPercent: 0.15,   // Extend hitbox horizontally as percentage of max line length (0.15 = 15% on each side)
                                // The physics body is longer than what you see
                                // Example: max=300px, 0.15 = 45px extension on each end for all lines

      thicknessMultiplier: 2.0, // Extend hitbox vertically as multiplier of mascot radius (2.0 = 2x radius)
                                // Makes the line "thicker" than it appears for easier collision
                                // Example: 30px radius, 2.0 = 60px invisible buffer (30px above + 30px below)
                                // Higher = more "late draw" forgiveness, 0 = exact visual match
    },

    preventDownwardBounce: true, // Prevent bouncing mascot downward (flip to upward instead)
                                 // Downward bounces accelerate death and are usually accidental
                                 // When enabled, any bounce with downward velocity gets flipped upward
  },

  // === COINS ===
  coins: {
    enabled: false,            // Enable/disable coin collection system

    // Visual properties (rounded rectangle pill shape)
    width: 8,                 // Coin width in pixels (small pill)
    height: 12,               // Coin height in pixels
    cornerRadius: 4,          // Border radius for rounded corners
    useDynamicColor: true,    // Use dynamic primary color (true) or static color (false)
    staticColor: '#FFD700',   // Static gold color (only used if useDynamicColor is false)

    // Physics animation (coin pops out and falls with gravity)
    physics: {
      enabled: true,          // Use physics simulation
      velocityX: 0,           // Initial horizontal velocity (pixels/frame)
      velocityY: -12,         // Initial vertical velocity (negative = upward pop, pixels/frame) - stronger pop!
      gravity: 0.3,           // Gravity acceleration (pixels/frame²) - lighter gravity for longer hang time
      lifetime: 1000,         // How long coin exists before fading (ms)
      fadeDuration: 300,      // Fade-out duration at end (ms)
      fadeOnDescent: true,    // Start fading as soon as coin starts falling down
      fadeSpeed: 0.08,        // How quickly to fade on descent (higher = faster fade, multiplied by downward velocity)
    },

    // Rotation animation (horizontal scale oscillation to simulate spinning)
    rotation: {
      enabled: true,          // Enable rotation effect
      speed: 0.08,            // Rotation speed (higher = faster spin)
      minScale: 0.2,          // Minimum horizontal scale (how thin coin gets)
      maxScale: 1.0,          // Maximum horizontal scale (full width)
    },

    // Death screen display
    deathScreen: {
      show: true,             // Show coin count on death
      fontSize: 48,           // Font size for coin count
      useDynamicColor: true,  // Use dynamic primary color for count text
      staticColor: '#FFD700', // Static gold color (only used if useDynamicColor is false)
      yPosition: 0.4,         // Vertical position (0.4 = 40% from top)
      fadeInMs: 300,          // Fade-in duration (ms)
      cutsceneDelayMs: 0,    // Delay before cutscene starts (0 = immediately with death)
      cutsceneDurationMs: 3000, // How long cutscene displays (will animate progress bar)
    },
  },

  // === PROGRESS BAR ===
  progressBar: {
    enabled: true,              // Enable/disable progress bar
    size: 120,                   // Diameter in pixels (increased from 60)
    strokeWidth: 6,              // Progress ring thickness (increased from 4)
    progressPerCoin: 0.01,       // Progress amount per coin (0.01 = 1% per coin)
    fadeDurationMs: 300,         // Fade in/out duration
    coinsPerFullBar: 20,         // Number of coins needed to fill progress bar from 0 to 1.0
    coinDepositIntervalMs: 200,  // Time between each coin deposit animation (ms)
    coinDepositStartDelayMs: 800, // Initial delay before deposit animation starts (ms) - time to see coin count
    
    // Position during idle (before game starts) - top right, matching admin button style
    idlePosition: {
      top: 50,
      right: 50,
    },
    
    // Position during cutscene (after death) - centered on screen
    cutscenePosition: {
      top: '50%',
      left: '50%',
      transform: [{ translateX: -60 }, { translateY: -60 }], // Center (half of size = 120/2 = 60)
    },
  },

  // === BOUNCING ===
  bounce: {
    minIntervalMs: 100,       // Debounce timer in milliseconds to prevent double-bouncing on same Gelato
  },

  // === WALLS (Screen Boundaries) ===
  walls: {
    behavior: 'bounce',       // Boundary behavior: 'bounce' (reflect) or 'wrap' (teleport to other side)
    restitution: 1,         // Wall bounciness (0 = absorbs all energy, 0.5 = loses half, 1 = perfect bounce)
    thickness: 5,             // Thickness of boundary walls in pixels (affects physics collision edge)
    visible: false,           // Whether to render walls visually (false = invisible boundaries at screen edges)

    // Wall bounce particle effect (dust clouds)
    particles: {
      enabled: false,          // Enable/disable wall bounce particles
      count: 3,               // Number of particles per wall bounce
      sizeMin: 10,             // Minimum particle radius in pixels
      sizeMax: 20,             // Maximum particle radius in pixels
      velocityMin: 1,         // Minimum initial velocity
      velocityMax: 2,         // Maximum initial velocity
      spreadAngle: 60,        // Spray angle in degrees (relative to perpendicular)
      gravity: 0.05,          // Gravity affecting particles (lower = floatier)
      fadeOutMs: 1500,         // How long particles take to fade out
      shrink: true,           // Whether particles shrink as they fade
    },

    // Wall glow effect (impact feedback)
    glow: {
      enabled: true,          // Toggle wall glow on/off
      fadeOutMs: 800,         // Fade duration in milliseconds
      opacity: 0.9,           // Peak opacity (0.9 = very bright, emphasizes impact)
      scaleX: 0.5,            // Horizontal width (narrow vertical bar)
      scaleY: 3.0,            // Vertical height (tall to cover impact area)
      blur: 25,               // Blur radius in pixels (soft glow)
      xOffset: 0,             // Distance from wall edge (pixels, 0 = at wall)
    },
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


  // === PARALLAX STARFIELD ===
  // Multi-layer scrolling background that creates illusion of climbing through space
  // Stars move downward as ball travels upward (cumulative upward distance only)
  parallax: {
    enabled: true,                // Toggle parallax background on/off
    density: 0.1,                 // Density multiplier (0.5 = half as many stars, 1.0 = default, 2.0 = double)
    opacity: 0.5,                 // Global opacity multiplier (0.3 = subtle, 0.5 = half brightness, 1.0 = full)

    speedMultiplier: 2.0,         // Global speed multiplier for parallax effect (1.0 = 1:1, 2.0 = 2x more impact)
                                  // Makes stars move faster relative to ball's upward movement

    easing: 0,                    // Easing factor (0 = instant, disabled for now)

    // Multiple layers for depth effect (back to front)
    // Each layer moves at different speed relative to ball's upward movement
    // Base star counts will be multiplied by density setting above
    // All layers use the same opacity (set globally above)
    layers: [
      // Background layer - slow, small (distant stars)
      {
        speed: 0.15,              // 15% of ball's upward speed (slow parallax)
        starCount: 20,            // Base number of stars (multiplied by density)
        sizeMin: 2,               // Minimum star radius in pixels
        sizeMax: 1.5,             // Maximum star radius in pixels
      },
      // Middle layer - medium speed
      {
        speed: 0.4,               // 40% of ball's upward speed
        starCount: 30,            // Base number of stars (multiplied by density)
        sizeMin: 2,
        sizeMax: 3.5,
      },
      // Foreground layer - fast, large (close stars)
      {
        speed: 0.8,               // 80% of ball's upward speed (fast parallax)
        starCount: 25,            // Base number of stars (multiplied by density)
        sizeMin: 2.5,
        sizeMax: 4,
      },
    ],

    wrapPadding: 150,             // Extra space above/below screen for smooth wrapping (pixels)
    color: '#FFFFFF',             // Star color (white)
    
    // Star shape configuration
    starShape: 'plus',            // Shape: 'plus' (4-pointed cross) or 'diamond' (4-pointed diamond)
    armThickness: 0.25,           // Thickness of star arms relative to size (0.25 = 25% of size)
    
    // Twinkle animation (subtle opacity pulsing)
    twinkle: {
      enabled: true,              // Enable/disable twinkling animation
      speed: 1.0,                 // Speed multiplier (1.0 = default, 2.0 = twice as fast, 0.5 = half speed)
      intensity: .8,             // Opacity variation (0.3 = ±30% opacity change, 0.5 = ±50%)
    },
  },

  // === VISUALS ===
  visuals: {
    backgroundColor: '#000000',   // Canvas background color (pure black)
    wordColor: '#FFFFFF',         // Text color for revealed words
    wordFontSize: 145,            // Base font size for revealed words in pixels
    wordMaxWidthPercent: 98,      // Max % of screen width for words (auto-scales down if needed)

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

  // === COLOR SYSTEM ===
  // Monochromatic design: single primary color used throughout (ball, trail, gelato, UI, text)
  colors: {
    mode: 'time',          // 'static' = fixed color, 'bounce' = change per bounce, 'time' = gradual fade
    
    // Color palette (used when mode is 'bounce' or 'time')
    palette: [
      '#FFFFFF',  // White
      '#4ECDC4',  // Cyan
      '#FF6B6B',  // Red
      '#A8E6CF',  // Mint
      '#FF8B94',  // Pink
      '#95E1D3',  // Aqua
      '#F3A683',  // Orange
      '#786FA6',  // Purple
    ],
    
    // Static mode: use this single color
    staticColor: '#FFFFFF',
    
    // Bounce mode: control when color changes
    // - Number (e.g., 1, 2, 5): Change every N bounces (1 = every bounce, 2 = every other bounce)
    // - 'quote': Change only when message/quote completes and restarts
    bouncesPerColorChange: 1,
    
    // Time mode: how long to transition between colors (ms)
    timeFadeDuration: 5000,
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
    showFps: false,               // Show FPS counter in corner (false = hidden by default)
  },

  // === VOICE TRANSFORMATION ===
  voiceTransform: {
    enabled: true,                          // Default state for toggle in AudioRecorder
    modelId: 'eleven_multilingual_sts_v2',  // ElevenLabs model

    // Available voices (only enabled voices will be used)
    // If only 1 voice is enabled, ball tap switching will be disabled
    voices: [
      {
        id: 'q6bhPxtykZeN8o4aUNuh',
        name: 'Reboundhi',
        key: 'reboundhi',                   // Key used internally for voice selection
        default: true,                      // Default voice in preview
        enabled: true,                      // Set to false to disable this voice
      },
      {
        id: 'UyE5iFj5Rg2T7GorYAnJ',
        name: 'Reboundhita',
        key: 'reboundhita',                 // Key used internally for voice selection
        default: false,
        enabled: false,                     // DISABLED - Set to true to enable switching
      },
    ],
  },

  // === GITHUB STORAGE ===
  github: {
    audioFolder: 'audio-messages/',         // Folder for audio files in GitHub repo
  },

  // === LOGGING ===
  // === DEBUG MODE ===
  // Master switch for all debug UI elements (debug menu, FPS counter, etc.)
  // Set to false to hide all debug UI for a clean production look
  debugMode: false,

  // Feature-based logging toggles
  // Set to true to enable console logs for specific features
  // High-frequency logs (disabled by default to reduce noise)
  logs: {
    PHYSICS: false,              // Body creation, collisions, updates (very frequent)
    AUDIO_PLAYBACK: false,       // Word sync, playback events (frequent during gameplay)
    TOUCH_INPUT: false,          // Touch events, line drawing (very frequent)
    RENDERING: false,            // Frame rendering, Skia canvas (60fps potential)

    // Medium-frequency logs (enable when debugging specific features)
    TRANSCRIPTION: false,        // API calls, word detection
    WORD_ALIGNMENT: false,       // RMS envelope, silence trimming
    HAPTICS: false,              // Vibration feedback

    // Low-frequency logs (enabled by default for important events)
    AUDIO_RECORDING: true,       // Recording lifecycle, permissions
    GITHUB_API: true,            // Fetch/upload operations
    ADMIN_UI: true,              // Navigation, state transitions
    VOICE_TRANSFORMATION: true,  // ElevenLabs API, voice switching
    INITIALIZATION: true,        // Component mounting, engine setup
  },
};
