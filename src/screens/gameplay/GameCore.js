import Matter from 'matter-js';
import { config } from '../../config';
import { playSound, playDeathArpeggio } from '../../shared/utils/audio';
import { createAudioPlayer } from 'expo-audio';
import { ParallaxManager } from '../../shared/effects/ParallaxManager';
import { logger } from '../../shared/utils/logger';
import { notifyBounce, notifyMessageRestart } from '../../shared/services/primaryColorManager';
import { quantizeVelocityAngle } from '../../shared/utils/physics';
import { getProgress } from '../../shared/services/progressStorage';

/**
 * GameCore - Physics engine using Matter.js
 * Handles all physics simulation, collision detection, and game state
 */
export class GameCore {
  constructor(width, height, customMessage = null, audioUri = null, wordTimings = null, wordAudioSegments = null, responsiveConfig = null) {
    // Create Matter.js engine
    this.engine = Matter.Engine.create();
    this.world = this.engine.world;

    // Set gravity from config
    this.engine.gravity.y = config.physics.gravityY;

    // Store dimensions
    this.width = width;
    this.height = height;
    
    // Store responsive config (if provided, overrides static config values)
    this.mascotRadius = responsiveConfig?.mascotRadius || config.physics.mascot.radius;
    this.gelatoMaxLength = responsiveConfig?.gelatoMaxLength || config.gelato.maxLength;

    // Store custom message for preview mode
    this.customMessage = customMessage;

    // Store audio data for voice playback
    this.audioUri = audioUri;
    this.wordTimings = wordTimings;
    this.wordAudioSegments = wordAudioSegments; // Keep for compatibility but won't use
    this.audioPlayer = null; // expo-audio player for full recording

    // Create expo-audio player for full recording if available
    if (audioUri && wordTimings && wordTimings.length > 0) {
      try {
        this.audioPlayer = createAudioPlayer({ uri: audioUri });
        // Set voice volume from config (default 0.5 = 50% volume)
        if (this.audioPlayer && config.audio && config.audio.voiceVolume !== undefined) {
          this.audioPlayer.volume = config.audio.voiceVolume;
        }
        logger.log('AUDIO_PLAYBACK', 'Expo-audio player created for full recording');
      } catch (error) {
        logger.error('AUDIO_PLAYBACK', 'Failed to create audio player:', error);
      }
    }

    // Store target position for entrance animation
    this.mascotTargetY = height * 0.25; // 25% from top = 75% near top

    // Create mascot (starts above screen for entrance animation)
    this.mascot = Matter.Bodies.circle(
      width / 2,
      -this.mascotRadius * 2, // Start above screen
      this.mascotRadius,
      {
        restitution: config.physics.mascot.restitution,
        friction: config.physics.mascot.friction,
        frictionAir: config.physics.mascot.frictionAir,
        mass: config.physics.mascot.mass,
        label: 'mascot',
        // Always dynamic, we'll control gravity manually
      }
    );

    Matter.World.add(this.world, this.mascot);

    // Track entrance animation
    this.entranceStartTime = Date.now();
    this.entranceComplete = false;

    // Track idle float animation timing
    this.idleFloatStartTime = null; // Will be set when entrance completes

    // Track whether game has started
    this.gameStarted = false;

    // Track loss state
    this.hasLost = false;

    // Track death fade-out animation
    this.deathFadeStartTime = null; // Timestamp when death fade started
    this.deathFadeProgress = 0;     // 0.0 = visible, 1.0 = fully faded
    this.deathStartTime = null;      // Timestamp when death started (for coin count timing)

    // Track bounce count for difficulty progression
    this.bounceCount = 0;

    // Track coins collected
    this.coinCount = 0;
    this.coins = []; // Array of coin animations: { x, y, timestamp }
    this.lastCoinSpawnTime = null; // Track when last coin was spawned (for death screen timing)
    
    // Coin count cutscene state
    this.coinCountCutsceneActive = false;
    this.coinCountCutsceneStartTime = null;

    // Store current time scale for difficulty (time dilation approach)
    this.timeScale = 1.0;

    // Initialize parallax background manager
    this.parallaxManager = new ParallaxManager(width, height, config.parallax);

    // Create boundary walls using config
    const wallThickness = config.walls.thickness;
    const halfThickness = wallThickness / 2;

    // Side walls only (no bottom boundary - ball can fall off)
    const leftWall = Matter.Bodies.rectangle(
      halfThickness,
      height / 2,
      wallThickness,
      height,
      {
        isStatic: true,
        label: 'wall',
        restitution: config.walls.restitution,
      }
    );

    const rightWall = Matter.Bodies.rectangle(
      width - halfThickness,
      height / 2,
      wallThickness,
      height,
      {
        isStatic: true,
        label: 'wall',
        restitution: config.walls.restitution,
      }
    );

    Matter.World.add(this.world, [leftWall, rightWall]);

    // Store obstacles for rendering
    this.obstacles = [leftWall, rightWall];

    // Track Gelatos (player-drawn springboards)
    this.gelato = null; // Only one Gelato at a time (maxActiveGelatos = 1)
    this.gelatoLineData = null; // Store start/end points for rendering

    // Track last bounce time for debouncing
    this.lastBounceTime = 0;

    // Track bounce impact for visual deformation
    this.bounceImpact = null; // { x, y, strength, timestamp }

    // Track creation time for pop-in animation
    this.gelatoCreationTime = null;
    
    // Motion trail tracking (supports multiple overlapping trails)
    this.trails = []; // Array of trail arrays: [{ points: [{x, y, timestamp}], bounceTime }]
    this.currentTrail = []; // Current active trail being drawn
    this.lastTrailTime = 0;
    this.lastBounceForTrail = 0; // Timestamp of last gelato bounce (for trail activation)

    // Particle system (wall bounce dust clouds)
    this.particles = []; // Array of { x, y, vx, vy, size, opacity, timestamp }

    // Wall glow effects (impact feedback on side walls)
    this.wallGlows = []; // Array of { side, y, timestamp }
    this.lastWallBumpSound = null; // Track last played sound to prevent consecutive repeats
    this.lastGelatoBounceSound = null; // Track last played gelato bounce sound to prevent consecutive repeats
    this.lastBounceSound = null; // Track the very last bounce sound (wall or gelato) for death arpeggio

    // Bounce juice effects (Gelato bounce feedback)
    this.bounceRipples = []; // Array of { x, y, timestamp }
    this.lastBounceScale = null; // { timestamp } for mascot scale animation

    // Downward bounce prevention (needs to be applied AFTER Matter.js collision resolution)
    this.needsVelocityFlip = false; // Flag to flip velocity after Engine.update()

    // 3D Sphere rotation state
    this.sphereRotationX = 0; // Current rotation around X axis (tilt forward/back)
    this.sphereRotationY = 0; // Current rotation around Y axis (spin left/right)
    this.sphereRotationZ = 0; // Current rotation around Z axis (roll clockwise/counter-clockwise)
    this.sphereRotationVelX = 0; // Rotation velocity from bounce impulse
    this.sphereRotationVelY = 0; // Rotation velocity from bounce impulse
    this.sphereRotationVelZ = 0; // Rotation velocity from bounce impulse (roll)

    // Color system - now managed by primaryColorManager
    // Color updates are handled externally for universal access

    // Message system (Milestone 3)
    // Use custom message if provided (for preview mode), otherwise use default
    if (wordTimings && wordTimings.length > 0) {
      // Use words from transcription (with exact timing alignment)
      // Strip punctuation from displayed words
      this.message = wordTimings.map(t =>
        t.word.toLowerCase().replace(/[.,!?;:'"]/g, '')
      );
      logger.log('INITIALIZATION', 'Using transcribed words for message:', this.message);
    } else if (customMessage) {
      // Fall back to splitting custom message text
      this.message = customMessage.toLowerCase().split(/\s+/);
    } else {
      // Default fallback message (will be replaced by loaded message from GitHub)
      this.message = [
        "you", "are", "loved", "beyond", "measure",
        "and", "nothing", "can", "change", "that"
      ];
    }
    this.wordIndex = 0; // Current word in message
    this.currentWord = null; // Currently displayed word { text, timestamp }
    this.shouldSpawnCoinOnNextBounce = false; // Flag to spawn coin after message completes
    
    // Audio playback tracking for mouth animation
    this.audioPlayingUntil = 0; // Timestamp when current word audio will finish

    // Load current message from messages.json if not in preview mode
    // Preview mode is detected by presence of wordTimings or wordAudioSegments
    const isPreviewMode = wordTimings || wordAudioSegments || customMessage;

    if (!isPreviewMode) {
      this.messageLoadPromise = this.loadCurrentMessage();
    } else {
      // Preview mode - message is already set, resolve immediately
      this.messageLoadPromise = Promise.resolve();
    }

    // Set up collision event handler
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      this.handleCollision(event);
    });
  }

  /**
   * Update physics simulation
   * Call this every frame with delta time
   */
  step(deltaMs) {
    // Update death fade progress continuously (even during cutscene)
    if (this.hasLost && this.deathFadeStartTime !== null) {
      const currentTime = Date.now();
      const elapsed = currentTime - this.deathFadeStartTime;
      const fadeOutMs = config.physics.death.fadeOutMs;
      
      // Update fade progress (0.0 = visible, 1.0 = fully faded)
      // This continues to update even during the coin cutscene
      this.deathFadeProgress = Math.min(1.0, elapsed / fadeOutMs);
    }

    // Handle coin count cutscene (after death, before reset)
    if (this.coinCountCutsceneActive && this.coinCountCutsceneStartTime !== null) {
      const currentTime = Date.now();
      const cutsceneElapsed = currentTime - this.coinCountCutsceneStartTime;
      const cutsceneDuration = config.coins.deathScreen.cutsceneDurationMs;

      // When cutscene duration completes, trigger reset
      if (cutsceneElapsed >= cutsceneDuration) {
        this.completeReset();
      }

      // Still update coins during cutscene so they animate
      if (config.coins.enabled) {
        this.updateCoins();
      }

      return; // Skip all other updates during cutscene
    }

    // Handle death fade-out animation
    if (this.hasLost && this.deathFadeStartTime !== null) {
      const currentTime = Date.now();
      const elapsed = currentTime - this.deathFadeStartTime;
      const fadeOutMs = config.physics.death.fadeOutMs;
      const delayBeforeReset = config.physics.death.delayBeforeResetMs;

      // Check if coins are enabled and cutscene should start
      // Only show cutscene if player collected at least 1 coin (skip if 0 coins)
      if (config.coins.enabled && this.deathStartTime !== null && this.coinCount > 0) {
        const cutsceneDelay = config.coins.deathScreen.cutsceneDelayMs;
        const cutsceneStartTime = this.deathStartTime + cutsceneDelay;

        // Activate cutscene when delay has passed
        if (currentTime >= cutsceneStartTime && !this.coinCountCutsceneActive) {
          this.coinCountCutsceneActive = true;
          this.coinCountCutsceneStartTime = currentTime;
        }
      }

      // If coins disabled OR no coins collected, reset immediately after death fade completes
      if ((!config.coins.enabled || this.coinCount === 0) && elapsed >= fadeOutMs + delayBeforeReset) {
        this.completeReset();
      }

      // Still update coins during death fade so they animate
      if (config.coins.enabled) {
        this.updateCoins();
      }

      return; // Skip all other updates during death fade
    }

    // Disable gravity before game starts (manual position control)
    if (!this.gameStarted) {
      Matter.Body.setVelocity(this.mascot, { x: 0, y: 0 });
    }

    // Check for loss (ball fell below screen)
    if (this.gameStarted && !this.hasLost && this.mascot.position.y > this.height + this.mascotRadius * 2) {
      this.handleLoss();
      return; // Skip physics update on loss frame
    }

    // Handle entrance animation (with delay)
    if (!this.entranceComplete) {
      const elapsed = Date.now() - this.entranceStartTime;
      const delayMs = config.physics.entrance.delayMs;
      const durationMs = config.physics.entrance.durationMs;

      // Wait for delay before starting animation
      if (elapsed < delayMs) {
        // Still waiting, keep ball above screen
        return;
      }

      // Calculate progress after delay
      const animationElapsed = elapsed - delayMs;
      const progress = Math.min(animationElapsed / durationMs, 1);

      // Ease-out cubic easing for smooth deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      const startY = -this.mascotRadius * 2;
      const newY = startY + (this.mascotTargetY - startY) * easeProgress;

      Matter.Body.setPosition(this.mascot, {
        x: this.mascot.position.x,
        y: newY,
      });

      if (progress >= 1) {
        this.entranceComplete = true;
        // Start idle float timing from now to ensure smooth transition
        this.idleFloatStartTime = Date.now();
      }
    }
    // Handle floating animation when stationary (before game starts)
    else if (!this.gameStarted) {
      // Use time relative to when idle float started
      const time = (Date.now() - this.idleFloatStartTime) / 1000; // Convert to seconds

      // Sine wave for smooth up/down motion using config values
      const offset = Math.sin(time * config.physics.idleFloat.speed * Math.PI * 2) * config.physics.idleFloat.amplitude;

      Matter.Body.setPosition(this.mascot, {
        x: this.mascot.position.x,
        y: this.mascotTargetY + offset,
      });
    }

    // Apply time scale for difficulty progression (makes physics run faster)
    const scaledDelta = deltaMs * this.timeScale;
    Matter.Engine.update(this.engine, scaledDelta);

    // Apply velocity flip AFTER Matter.js collision resolution
    // This ensures our change isn't overwritten by Matter.js's internal solver
    if (this.needsVelocityFlip) {
      const vel = this.mascot.velocity;
      if (vel.y > 0) { // Still moving downward after resolution
        Matter.Body.setVelocity(this.mascot, {
          x: vel.x,
          y: -vel.y, // Flip to upward
        });
        logger.always(`FLIPPED after Engine.update: vy=${vel.y.toFixed(2)} → ${(-vel.y).toFixed(2)}`);
      }
      this.needsVelocityFlip = false; // Reset flag
    }

    // Update parallax background based on ball's Y position (only when game started)
    if (this.gameStarted) {
      this.parallaxManager.update(this.mascot.position.y);
    }

    // Update particles
    this.updateParticles(deltaMs);

    // Update coins
    this.updateCoins();

    // Update wall glows
    this.updateWallGlows();

    // Color updates are now handled by primaryColorManager (runs independently)
    
    // Update motion trail (supports multiple overlapping trails)
    if (config.physics.mascot.trail.enabled && this.gameStarted) {
      const currentTime = Date.now();
      const activeAfterBounceMs = config.physics.mascot.trail.activeAfterBounceMs;
      const endFadeDurationMs = config.physics.mascot.trail.endFadeDurationMs;

      const timeSinceBounce = currentTime - this.lastBounceForTrail;

      // Check if current trail should be completely removed (past active + fade windows)
      const isFullyExpired = activeAfterBounceMs > 0 &&
                            (timeSinceBounce > activeAfterBounceMs + endFadeDurationMs);

      if (isFullyExpired) {
        // Current trail has completely faded - clear it
        this.currentTrail = [];
      } else {
        // Trail is visible (either active or fading) - ALWAYS sample to follow ball
        if (currentTime - this.lastTrailTime >= config.physics.mascot.trail.sampleInterval) {
          this.currentTrail.push({
            x: this.mascot.position.x,
            y: this.mascot.position.y,
            timestamp: currentTime,
          });
          this.lastTrailTime = currentTime;

          // Limit trail length
          if (this.currentTrail.length > config.physics.mascot.trail.maxPoints) {
            this.currentTrail.shift();
          }
        }

        // Remove old trail points that have fully faded
        const fadeOutMs = config.physics.mascot.trail.fadeOutMs;
        this.currentTrail = this.currentTrail.filter(point =>
          currentTime - point.timestamp < fadeOutMs
        );
      }

      // Clean up old trails that have completely faded
      this.trails = this.trails.filter(trail => {
        const timeSinceTrailBounce = currentTime - trail.bounceTime;
        return timeSinceTrailBounce < activeAfterBounceMs + endFadeDurationMs;
      });
    }

    // Update 3D sphere rotation based on impulse and physics
    if (config.physics.mascot.sphere3D?.enabled) {
      const sphereConfig = config.physics.mascot.sphere3D;
      
      // Apply impulse rotation (from bounces, decays over time)
      if (sphereConfig.bounceImpulse?.enabled) {
        this.sphereRotationX += this.sphereRotationVelX;
        this.sphereRotationY += this.sphereRotationVelY;
        this.sphereRotationZ += this.sphereRotationVelZ;
        
        // Decay impulse velocities
        this.sphereRotationVelX *= sphereConfig.bounceImpulse.decay;
        this.sphereRotationVelY *= sphereConfig.bounceImpulse.decay;
        this.sphereRotationVelZ *= sphereConfig.bounceImpulse.decay;
        
        // Stop tiny movements
        if (Math.abs(this.sphereRotationVelX) < 0.001) this.sphereRotationVelX = 0;
        if (Math.abs(this.sphereRotationVelY) < 0.001) this.sphereRotationVelY = 0;
        if (Math.abs(this.sphereRotationVelZ) < 0.001) this.sphereRotationVelZ = 0;
      }
      
      // Velocity-based Y rotation: face looks in direction ball is moving
      // Moving left = face looks left, moving right = face looks right
      // Direct 1:1 mapping like vertical rotation
      const horizontalVelocityInfluence = sphereConfig.horizontalVelocityInfluence || 0.04;
      const maxY = sphereConfig.maxRotationY || 0.6;
      const velocityX = this.mascot.velocity.x;
      
      // Direct linear mapping: rotation = -velocity * influence (flipped direction)
      this.sphereRotationY = Math.max(-maxY, Math.min(maxY, -velocityX * horizontalVelocityInfluence));
      
      // Velocity-based X rotation: face looks up when moving up, down when falling
      // Pure linear 1:1 mapping: rotation directly proportional to velocity
      // velocity 0 = neutral face, positive velocity = looking down, negative = looking up
      const velocityInfluence = sphereConfig.velocityInfluence || 0.018;
      const maxX = sphereConfig.maxRotationX || 0.5;
      const velocityY = this.mascot.velocity.y;
      
      // Direct linear mapping: rotation = -velocity * influence
      // No smoothing, no tanh, just pure proportional response
      this.sphereRotationX = Math.max(-maxX, Math.min(maxX, -velocityY * velocityInfluence));
      
      // Return to center for Z rotation only (roll)
      if (sphereConfig.returnToCenter?.enabled) {
        const strength = sphereConfig.returnToCenter.strength;
        this.sphereRotationZ *= (1 - strength);
      }
      
      // Idle wobble when not playing (gentle oscillation on top of position)
      if (!this.gameStarted && sphereConfig.idleWobble?.enabled) {
        const time = Date.now() / 1000;
        const wobble = Math.sin(time * sphereConfig.idleWobble.speed * Math.PI * 2) * sphereConfig.idleWobble.amplitudeY;
        this.sphereRotationY += wobble * 0.3; // Add subtle wobble
      }
      
      // Clamp rotation to max values (keeps face mostly visible)
      const maxZ = sphereConfig.maxRotationZ || 0.3;
      this.sphereRotationX = Math.max(-maxX, Math.min(maxX, this.sphereRotationX));
      this.sphereRotationY = Math.max(-maxY, Math.min(maxY, this.sphereRotationY));
      this.sphereRotationZ = Math.max(-maxZ, Math.min(maxZ, this.sphereRotationZ));
    }

    // Apply velocity capping (safety valve) - scale caps with time dilation
    const velocity = this.mascot.velocity;
    const maxVelX = config.physics.maxVelocityX * this.timeScale;
    const maxVelY = config.physics.maxVelocityY * this.timeScale;

    if (Math.abs(velocity.x) > maxVelX) {
      Matter.Body.setVelocity(this.mascot, {
        x: Math.sign(velocity.x) * maxVelX,
        y: velocity.y,
      });
    }
    if (Math.abs(velocity.y) > maxVelY) {
      Matter.Body.setVelocity(this.mascot, {
        x: velocity.x,
        y: Math.sign(velocity.y) * maxVelY,
      });
    }

    // Clean up Gelato after fade completes
    if (this.bounceImpact && this.bounceImpact.timestamp) {
      const timeSinceBounce = Date.now() - this.bounceImpact.timestamp;
      if (timeSinceBounce >= config.gelato.fadeOutDuration) {
        // Fade is complete - remove Gelato data
        if (this.gelato) {
          Matter.World.remove(this.world, this.gelato);
          this.gelato = null;
        }
        this.gelatoLineData = null;
        this.bounceImpact = null;
      }
    }
  }

  /**
   * Update difficulty based on bounce count
   * Uses time dilation approach: makes physics simulation run faster
   * This creates a natural "fast-forward" effect where everything speeds up proportionally
   */
  updateDifficulty() {
    if (!config.difficulty.enabled) {
      return;
    }

    const { start, end, bouncesUntilMax } = config.difficulty.speed;

    // Calculate current time scale (linear interpolation)
    const progress = Math.min(this.bounceCount / bouncesUntilMax, 1);
    this.timeScale = start + (end - start) * progress;

    // Log difficulty changes for debugging
    logger.log('PHYSICS', `Bounce ${this.bounceCount}: timeScale = ${this.timeScale.toFixed(2)}x (${(this.timeScale * 100).toFixed(0)}% speed)`);
  }

  /**
   * Handle loss (ball fell off screen)
   */
  handleLoss() {
    this.hasLost = true;

    // Play death arpeggio starting from the last bounce note
    // Completes the chord descent from wherever the last note was
    playDeathArpeggio(this.lastBounceSound);

    // Start death fade-out animation
    const now = Date.now();
    this.deathFadeStartTime = now;
    this.deathStartTime = now; // Track death start for coin count timing
    this.deathFadeProgress = 0;
  }

  /**
   * Complete the reset after death fade-out finishes
   * This is called from step() after the fade animation completes
   */
  completeReset() {
    // Reset word index to start message from beginning
    this.wordIndex = 0;
    this.currentWord = null;
    this.shouldSpawnCoinOnNextBounce = false; // Reset coin spawn flag

    // Notify color manager of message restart (for bounce mode with 'quote' setting)
    if (config.colors.mode === 'bounce' && config.colors.bouncesPerColorChange === 'quote') {
      notifyMessageRestart();
    }

    // Remove any existing gelato
    if (this.gelato) {
      Matter.World.remove(this.world, this.gelato);
      this.gelato = null;
      this.gelatoLineData = null;
      this.bounceImpact = null;
    }

    // Clear motion trails
    this.trails = [];
    this.currentTrail = [];
    this.lastTrailTime = 0;
    this.lastBounceForTrail = 0;

    // Clear wall glows
    this.wallGlows = [];

    // Reset ball to starting position (above screen)
    Matter.Body.setPosition(this.mascot, {
      x: this.width / 2,
      y: -this.mascotRadius * 2,
    });

    // Clear velocity (gravity will be disabled by !gameStarted check)
    Matter.Body.setVelocity(this.mascot, { x: 0, y: 0 });

    // Reset entrance animation
    this.entranceStartTime = Date.now();
    this.entranceComplete = false;
    this.idleFloatStartTime = null;
    this.gameStarted = false;
    this.hasLost = false;

    // Reset death fade state
    this.deathFadeStartTime = null;
    this.deathFadeProgress = 0;
    this.deathStartTime = null;
    this.lastCoinSpawnTime = null; // Reset coin spawn tracking
    
    // Reset cutscene state
    this.coinCountCutsceneActive = false;
    this.coinCountCutsceneStartTime = null;

    // Reset bounce count and difficulty
    this.bounceCount = 0;
    this.updateDifficulty();
  }

  /**
   * Handle collision events
   */
  handleCollision(event) {
    const pairs = event.pairs;

    for (const pair of pairs) {
      const { bodyA, bodyB } = pair;

      // Check if mascot hit a Gelato
      const mascotBody = bodyA.label === 'mascot' ? bodyA : bodyB.label === 'mascot' ? bodyB : null;
      const gelatoBody = bodyA.label === 'gelato' ? bodyA : bodyB.label === 'gelato' ? bodyB : null;

      if (mascotBody && gelatoBody) {
        // Check debounce timer
        const currentTime = Date.now();
        if (currentTime - this.lastBounceTime < config.bounce.minIntervalMs) {
          continue; // Skip this bounce (too soon)
        }

        this.lastBounceTime = currentTime;

        // Activate trail on gelato bounce - archive old trail and start fresh
        if (this.currentTrail.length > 0) {
          this.trails.push({
            points: [...this.currentTrail], // Copy current trail
            bounceTime: this.lastBounceForTrail, // Use old bounce time for fade calculation
          });
        }
        this.lastBounceForTrail = currentTime;
        this.currentTrail = []; // Start fresh trail
        
        // Notify color manager of bounce (for bounce mode)
        if (config.colors.mode === 'bounce') {
          notifyBounce();
        }
        
        // Apply spring boost perpendicular to Gelato
        const angle = gelatoBody.angle;
        const normalX = -Math.sin(angle); // Perpendicular to line
        const normalY = Math.cos(angle);

        // Calculate how hard the ball is hitting the Gelato (dot product)
        const currentVelocity = mascotBody.velocity;
        const impactSpeed = currentVelocity.x * normalX + currentVelocity.y * normalY;

        // Scale springBoost inversely with timeScale to maintain consistent bounce height
        // When time runs faster, ball hits harder, so we need less boost to reach same height
        const effectiveSpringBoost = config.gelato.springBoost / this.timeScale;

        // Apply trampoline effect: reflect velocity across normal and amplify
        // Remove the component moving INTO the gelato and add it back multiplied
        const boostVelocity = -impactSpeed * (1 + effectiveSpringBoost);

        Matter.Body.setVelocity(mascotBody, {
          x: currentVelocity.x + normalX * boostVelocity,
          y: currentVelocity.y + normalY * boostVelocity,
        });

        // Quantize bounce angle to discrete directions
        if (config.physics.mascot.angleQuantization.enabled) {
          const vel = mascotBody.velocity;
          const quantized = quantizeVelocityAngle(
            vel.x,
            vel.y,
            config.physics.mascot.angleQuantization.numDirections,
            {
              preventStraightUp: config.physics.mascot.angleQuantization.preventStraightUp,
            }
          );

          Matter.Body.setVelocity(mascotBody, quantized);

          // Optional: Debug logging
          if (config.logs.PHYSICS) {
            const oldAngle = (Math.atan2(vel.y, vel.x) * 180 / Math.PI).toFixed(1);
            const newAngle = (Math.atan2(quantized.y, quantized.x) * 180 / Math.PI).toFixed(1);
            logger.log('PHYSICS', `Quantized bounce: ${oldAngle}° → ${newAngle}°`);
          }
        }

        // Prevent downward bounces (flip to upward if moving down)
        // Mark for flipping AFTER Matter.js collision resolution completes
        if (config.gelato.preventDownwardBounce) {
          const vel = mascotBody.velocity;
          if (vel.y > 0) { // Moving downward (positive Y is down in screen coordinates)
            this.needsVelocityFlip = true;
            logger.always(`Marking for velocity flip: vy=${vel.y.toFixed(2)} will be flipped AFTER Engine.update()`);
          }
        }

        // Randomly pick one of the deep bass chord tones for musical variety (but prevent consecutive repeats)
        const gelatoBounceVariants = ['gelato-bounce-C2', 'gelato-bounce-E2', 'gelato-bounce-G2', 'gelato-bounce-C3'];
        const availableBounceVariants = gelatoBounceVariants.filter(v => v !== this.lastGelatoBounceSound);
        const randomBounceVariant = availableBounceVariants[Math.floor(Math.random() * availableBounceVariants.length)];
        this.lastGelatoBounceSound = randomBounceVariant;
        this.lastBounceSound = randomBounceVariant; // Track for death arpeggio
        playSound(randomBounceVariant);

        // Bounce juice effects (radial ripple + mascot scale pulse + collision glow)
        if (config.physics.mascot.bounceJuice.ripple.enabled) {
          this.bounceRipples.push({
            x: mascotBody.position.x,
            y: mascotBody.position.y,
            timestamp: currentTime,
          });
        }
        if (config.physics.mascot.bounceJuice.scale.enabled) {
          this.lastBounceScale = { timestamp: currentTime };
        }

        // Store impact data for visual deformation
        this.bounceImpact = {
          x: mascotBody.position.x,
          y: mascotBody.position.y,
          strength: Math.abs(impactSpeed),
          timestamp: currentTime,
        };

        // Apply 3D sphere rotation impulse on bounce
        // Face tilts in the direction of the bounce (physically intuitive)
        if (config.physics.mascot.sphere3D?.enabled && config.physics.mascot.sphere3D?.bounceImpulse?.enabled) {
          const sphereConfig = config.physics.mascot.sphere3D;
          const vel = mascotBody.velocity;
          const strength = sphereConfig.bounceImpulse.strength;
          
          // Horizontal velocity causes horizontal spin (like a ball rolling)
          // Positive X velocity = spinning right = negative Y rotation visually
          this.sphereRotationVelY += -vel.x * strength * 0.02;
          
          // Impact causes slight forward tilt (like getting hit)
          this.sphereRotationVelX += Math.abs(vel.y) * strength * 0.01;
          
          // Z rotation (roll) based on bounce angle
          // If bouncing up-right, roll clockwise; if up-left, roll counter-clockwise
          // This creates a "banking" effect like an airplane turning
          this.sphereRotationVelZ += vel.x * strength * 0.03;
        }

        // Check if we just completed the message (wordIndex wrapped from last to 0)
        const wasLastWord = this.wordIndex === this.message.length - 1;
        
        // Spawn coin on bounce after message completion (no word revealed)
        if (config.coins.enabled && this.shouldSpawnCoinOnNextBounce) {
          this.coinCount++;
          this.coins.push({
            x: mascotBody.position.x,
            y: mascotBody.position.y,
            vx: config.coins.physics.velocityX,
            vy: config.coins.physics.velocityY,
            timestamp: currentTime,
            rotationPhase: Math.random() * Math.PI * 2, // Random initial rotation phase
          });
          this.lastCoinSpawnTime = currentTime; // Track spawn time for death screen timing
          playSound('pickup-coin');
          this.shouldSpawnCoinOnNextBounce = false; // Reset flag
          // Clear current word so no text is displayed on coin bounce
          this.currentWord = null;
        } else {
          // Reveal next word (Milestone 3)
          this.revealNextWord();
          
          // If we just completed the message (wrapped from last word to 0), 
          // set flag to spawn coin on next bounce (without revealing a word)
          if (wasLastWord && this.wordIndex === 0) {
            this.shouldSpawnCoinOnNextBounce = true;
          }
        }

        // Increment bounce count and update difficulty
        this.bounceCount++;
        this.updateDifficulty();
      }

      // Check if mascot hit a wall/boundary
      const wallBody = bodyA.label === 'wall' ? bodyA : bodyB.label === 'wall' ? bodyB : null;
      if (mascotBody && wallBody) {
        // Wall bounce rotation is now handled automatically via velocity-based rotation
        // When ball bounces off wall, its X velocity changes direction,
        // and the face rotation follows the velocity directly

        // Randomly pick one of the chord tones for musical variety (but prevent consecutive repeats)
        const wallBumpVariants = ['wall-bump-C4', 'wall-bump-E4', 'wall-bump-G4', 'wall-bump-C5'];
        const availableVariants = wallBumpVariants.filter(v => v !== this.lastWallBumpSound);
        const randomVariant = availableVariants[Math.floor(Math.random() * availableVariants.length)];
        this.lastWallBumpSound = randomVariant;
        this.lastBounceSound = randomVariant; // Track for death arpeggio
        playSound(randomVariant);

        // Spawn wall glow
        if (config.walls.glow.enabled) {
          const isLeftWall = wallBody.position.x < this.width / 2;
          this.wallGlows.push({
            side: isLeftWall ? 'left' : 'right',
            y: mascotBody.position.y,  // Exact Y position of impact
            timestamp: Date.now(),
          });
        }

        // Spawn particles on wall bounce
        if (config.walls.particles.enabled) {
          this.spawnWallParticles(mascotBody, wallBody);
        }
      }
    }
  }

  /**
   * Get mascot position for rendering
   */
  getMascotPosition() {
    return {
      x: this.mascot.position.x,
      y: this.mascot.position.y,
    };
  }
  
  /**
   * Get mascot radius (responsive)
   */
  getMascotRadius() {
    return this.mascotRadius;
  }

  getGelatoMaxLength() {
    return this.gelatoMaxLength;
  }

  /**
   * Get all obstacles for rendering
   */
  getObstacles() {
    return this.obstacles.map(body => ({
      x: body.position.x,
      y: body.position.y,
      width: body.bounds.max.x - body.bounds.min.x,
      height: body.bounds.max.y - body.bounds.min.y,
      angle: body.angle,
    }));
  }

  /**
   * Get parallax stars for rendering
   */
  getParallaxStars() {
    return this.parallaxManager.getStars();
  }

  /**
   * Get current primary color (now reads from universal color manager)
   */
  getPrimaryColor() {
    const { getPrimaryColor } = require('../../shared/services/primaryColorManager');
    return getPrimaryColor();
  }

  /**
   * Get motion trails for rendering (supports multiple overlapping trails)
   * Returns { trails: [{ points: [...], endFadeProgress: 0.0-1.0 }] }
   */
  getTrail() {
    if (!config.physics.mascot.trail.enabled) return { trails: [] };

    const currentTime = Date.now();
    const activeAfterBounceMs = config.physics.mascot.trail.activeAfterBounceMs;
    const endFadeDurationMs = config.physics.mascot.trail.endFadeDurationMs;

    const allTrails = [];

    // Add old trails with their fade progress
    for (const trail of this.trails) {
      const timeSinceBounce = currentTime - trail.bounceTime;
      let endFadeProgress = 0;

      if (activeAfterBounceMs > 0 && timeSinceBounce > activeAfterBounceMs) {
        const fadeTime = timeSinceBounce - activeAfterBounceMs;
        endFadeProgress = Math.min(1.0, fadeTime / endFadeDurationMs);
      }

      allTrails.push({
        points: trail.points,
        endFadeProgress,
      });
    }

    // Add current trail
    if (this.currentTrail.length > 0) {
      const timeSinceBounce = currentTime - this.lastBounceForTrail;
      let endFadeProgress = 0;

      if (activeAfterBounceMs > 0 && timeSinceBounce > activeAfterBounceMs) {
        const fadeTime = timeSinceBounce - activeAfterBounceMs;
        endFadeProgress = Math.min(1.0, fadeTime / endFadeDurationMs);
      }

      allTrails.push({
        points: this.currentTrail,
        endFadeProgress,
      });
    }

    return { trails: allTrails };
  }

  /**
   * Create a Gelato (springboard) from a drawn line
   * Returns the line data if created, null if max length exceeded
   * @param {number} startX - Start X position
   * @param {number} startY - Start Y position
   * @param {number} endX - End X position
   * @param {number} endY - End Y position
   * @param {Array} originalPath - Original drawn path array of {x, y} points (optional)
   */
  createGelato(startX, startY, endX, endY, originalPath = null) {
    // Start the game on first gelato creation
    if (!this.gameStarted) {
      this.gameStarted = true;
      // Ball is already dynamic, just enable physics by allowing gravity
    }

    // Check max length constraint
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length > this.gelatoMaxLength) {
      // Clamp to max length
      const scale = this.gelatoMaxLength / length;
      endX = startX + dx * scale;
      endY = startY + dy * scale;
    }

    // Destroy previous Gelato if exists (only one at a time)
    if (this.gelato) {
      Matter.World.remove(this.world, this.gelato);
    }

    // Calculate center point and angle
    const centerX = (startX + endX) / 2;
    const centerY = (startY + endY) / 2;

    // Normalize draw direction: always treat line as left-to-right
    // This ensures the normal always points in a consistent direction
    let normalizedStartX = startX;
    let normalizedStartY = startY;
    let normalizedEndX = endX;
    let normalizedEndY = endY;

    if (endX < startX) {
      // Line was drawn right-to-left, swap endpoints
      normalizedStartX = endX;
      normalizedStartY = endY;
      normalizedEndX = startX;
      normalizedEndY = startY;
    }

    const angle = Math.atan2(normalizedEndY - normalizedStartY, normalizedEndX - normalizedStartX);
    const gelatoLength = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);

    // Calculate responsive thickness (scale with mascot radius)
    // Base thickness is 4px at 30px radius, scale proportionally
    const baseThickness = 4;
    const baseRadius = 30;
    const responsiveThickness = (baseThickness / baseRadius) * this.mascotRadius;

    // Apply forgiveness extensions (invisible hitbox buffers)
    // Horizontal: extend length on both ends for left/right forgiveness
    const forgivenessExtension = this.gelatoMaxLength * config.gelato.forgiveness.extensionPercent;
    const physicsLength = gelatoLength + (forgivenessExtension * 2);

    // Vertical: add thickness multiplier for "late draw" forgiveness (ONLY BELOW)
    // Makes physics body thicker than visual line, but only extends downward
    const forgivenessThickness = this.mascotRadius * config.gelato.forgiveness.thicknessMultiplier;
    const physicsThickness = responsiveThickness + forgivenessThickness;

    // Offset center downward so extra thickness is only below the line
    // Calculate perpendicular direction (downward relative to line angle)
    const normalX = -Math.sin(angle); // Perpendicular to line
    const normalY = Math.cos(angle);
    const offsetDistance = forgivenessThickness / 2; // Half the extra thickness
    const offsetCenterX = centerX + normalX * offsetDistance;
    const offsetCenterY = centerY + normalY * offsetDistance;

    // Create static rectangular body for the Gelato
    // Note: physics body is longer AND thicker (below only) than visual line for easier collision
    this.gelato = Matter.Bodies.rectangle(
      offsetCenterX,
      offsetCenterY,
      physicsLength,
      physicsThickness,
      {
        isStatic: true,
        angle: angle,
        label: 'gelato',
        restitution: 0.1, // Low restitution - we handle bounce manually
      }
    );

    Matter.World.add(this.world, this.gelato);

    // Play gelato creation sound
    playSound('gelato-create');

    // Store line data for rendering (including original path for morphing animation)
    this.gelatoLineData = {
      startX,
      startY,
      endX,
      endY,
      originalPath: originalPath || null, // Store original drawn path
    };

    // Track creation time for pop-in and morphing animations
    this.gelatoCreationTime = Date.now();

    // Return line data for rendering
    return this.gelatoLineData;
  }

  /**
   * Get current Gelato for rendering (if exists)
   */
  getGelato() {
    if (!this.gelato) return null;

    return {
      x: this.gelato.position.x,
      y: this.gelato.position.y,
      angle: this.gelato.angle,
      width: this.gelato.bounds.max.x - this.gelato.bounds.min.x,
      height: this.gelato.bounds.max.y - this.gelato.bounds.min.y,
    };
  }

  /**
   * Destroy current Gelato
   */
  destroyGelato() {
    if (this.gelato) {
      Matter.World.remove(this.world, this.gelato);
      this.gelato = null;
      this.gelatoLineData = null;
      this.bounceImpact = null;
    }
  }

  /**
   * Get bounce impact data for visual deformation
   */
  getBounceImpact() {
    return this.bounceImpact;
  }

  /**
   * Get creation time for pop-in animation
   */
  getGelatoCreationTime() {
    return this.gelatoCreationTime;
  }

  /**
   * Reveal next word in message
   */
  revealNextWord() {
    const word = this.message[this.wordIndex];
    const mascotBody = this.mascot;
    this.currentWord = {
      text: word,
      timestamp: Date.now(),
      initialVelocityY: mascotBody.velocity.y, // Store Y velocity at bounce
    };

    // Play word from full audio recording by seeking to timestamp
    if (this.audioPlayer && this.wordTimings && this.wordTimings[this.wordIndex]) {
      const timing = this.wordTimings[this.wordIndex];

      // Skip sentence break markers (*)
      if (timing.word === '*') {
        logger.log('AUDIO_PLAYBACK', 'Skipping sentence break marker at word index', this.wordIndex);
      } else {
        try {
          // Seek to word start time (convert ms to seconds)
          const startSeconds = timing.start / 1000;
          const endSeconds = timing.end / 1000;
          const duration = endSeconds - startSeconds;

          // Track when audio will finish (for mouth animation)
          this.audioPlayingUntil = Date.now() + (duration * 1000);

          // Seek and play using expo-audio
          this.audioPlayer.seekTo(startSeconds);
          this.audioPlayer.play();

          logger.log('AUDIO_PLAYBACK', `🎵 "${timing.word}" (${startSeconds.toFixed(2)}s - ${endSeconds.toFixed(2)}s, ${(duration * 1000).toFixed(0)}ms)`);

          // Stop playback at word end
          setTimeout(() => {
            if (this.audioPlayer) {
              this.audioPlayer.pause();
            }
          }, duration * 1000);
        } catch (error) {
          logger.error('AUDIO_PLAYBACK', 'Audio playback failed:', error);
        }
      }
    }

    // Advance to next word (loop)
    this.wordIndex = (this.wordIndex + 1) % this.message.length;
  }

  /**
   * Get current word for display
   */
  getCurrentWord() {
    return this.currentWord;
  }

  /**
   * Check if voice audio is currently playing (for mouth animation)
   */
  isVoicePlaying() {
    return Date.now() < this.audioPlayingUntil;
  }

  /**
   * Get progress through current word audio (0 to 1)
   * Useful for smooth mouth animation
   */
  getVoiceProgress() {
    if (!this.currentWord || !this.audioPlayingUntil) return 0;
    const elapsed = Date.now() - this.currentWord.timestamp;
    const duration = this.audioPlayingUntil - this.currentWord.timestamp;
    if (duration <= 0) return 0;
    return Math.min(1, Math.max(0, elapsed / duration));
  }

  /**
   * Get current Y velocity of mascot
   */
  getMascotVelocityY() {
    return this.mascot.velocity.y;
  }

  /**
   * Get current X velocity of mascot
   */
  getMascotVelocityX() {
    return this.mascot.velocity.x;
  }

  /**
   * Get 3D sphere rotation state
   */
  getSphereRotation() {
    return {
      rotationX: this.sphereRotationX,
      rotationY: this.sphereRotationY,
      rotationZ: this.sphereRotationZ,
    };
  }

  /**
   * Get Gelato line data for rendering
   */
  getGelatoLineData() {
    return this.gelatoLineData;
  }

  /**
   * Update boundaries when screen size changes
   * Also updates responsive sizing for ball and gelatos
   */
  updateBoundaries(width, height, responsiveConfig = null) {
    this.width = width;
    this.height = height;
    
    // Update responsive config if provided (for resize events)
    if (responsiveConfig) {
      this.mascotRadius = responsiveConfig.mascotRadius;
      this.gelatoMaxLength = responsiveConfig.gelatoMaxLength;
      
      // Destroy existing gelato if it exists (it will be recreated with new size on next draw)
      if (this.gelato) {
        Matter.World.remove(this.world, this.gelato);
        this.gelato = null;
        this.gelatoLineData = null;
      }
      
      // Update mascot body radius (requires recreating the body)
      const currentPos = this.mascot.position;
      const currentVel = this.mascot.velocity;
      Matter.World.remove(this.world, this.mascot);
      
      this.mascot = Matter.Bodies.circle(
        currentPos.x,
        currentPos.y,
        this.mascotRadius,
        {
          restitution: config.physics.mascot.restitution,
          friction: config.physics.mascot.friction,
          frictionAir: config.physics.mascot.frictionAir,
          mass: config.physics.mascot.mass,
          label: 'mascot',
        }
      );
      
      Matter.Body.setVelocity(this.mascot, currentVel);
      Matter.World.add(this.world, this.mascot);
    }

    // Remove old boundaries
    this.obstacles.forEach(obstacle => {
      Matter.World.remove(this.world, obstacle);
    });

    // Create new boundaries with new dimensions (side walls only)
    const wallThickness = config.walls.thickness;
    const halfThickness = wallThickness / 2;

    const leftWall = Matter.Bodies.rectangle(
      halfThickness,
      height / 2,
      wallThickness,
      height,
      {
        isStatic: true,
        label: 'wall',
        restitution: config.walls.restitution,
      }
    );

    const rightWall = Matter.Bodies.rectangle(
      width - halfThickness,
      height / 2,
      wallThickness,
      height,
      {
        isStatic: true,
        label: 'wall',
        restitution: config.walls.restitution,
      }
    );

    Matter.World.add(this.world, [leftWall, rightWall]);
    this.obstacles = [leftWall, rightWall];
  }

  /**
   * Load current message from messages.json
   * Fetches from GitHub API (always fresh on refresh!)
   */
  async loadCurrentMessage() {
    try {
      // Get GitHub token from environment
      const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

      // Build GitHub API URL with cache buster to force fresh fetch
      const cacheBuster = Date.now();
      const url = `https://api.github.com/repos/preetoshii/spherical-truth-machine/contents/messages.json?ref=master&_=${cacheBuster}`;

      const headers = {
        'Accept': 'application/vnd.github.v3+json',
      };

      // Add authorization if token is available
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        logger.warn('GITHUB_API', 'Could not load messages.json from GitHub API, using fallback');
        return;
      }

      const apiData = await response.json();

      // GitHub API returns base64-encoded content
      const decodedContent = atob(apiData.content);
      const data = JSON.parse(decodedContent);

      const currentDate = data.current;
      const currentMessage = data.messages[currentDate];

      if (currentMessage && currentMessage.words) {
        this.message = currentMessage.words;
        logger.log('GITHUB_API', '✅ Loaded fresh message from GitHub:', this.message);

        // Load audio if available
        if (currentMessage.audio) {
          // Build GitHub raw URLs for audio files
          const audioFolder = config.github.audioFolder;
          const baseUrl = 'https://raw.githubusercontent.com/preetoshii/spherical-truth-machine/master/';

          // Prefer transformed audio, fallback to original
          let audioFilename = currentMessage.audio.transformed || currentMessage.audio.original;
          if (audioFilename) {
            this.audioUri = `${baseUrl}${audioFolder}${audioFilename}?t=${cacheBuster}`;
            logger.log('AUDIO_PLAYBACK', '✅ Loaded audio URI:', this.audioUri);

            // Create audio player
            try {
              this.audioPlayer = createAudioPlayer({ uri: this.audioUri });
              if (this.audioPlayer && config.audio && config.audio.voiceVolume !== undefined) {
                this.audioPlayer.volume = config.audio.voiceVolume;
              }
              logger.log('AUDIO_PLAYBACK', '✅ Created audio player from GitHub URL');
            } catch (error) {
              logger.error('AUDIO_PLAYBACK', 'Failed to create audio player:', error);
            }
          }

          // Load word timings if available
          if (currentMessage.wordTimings) {
            this.wordTimings = currentMessage.wordTimings;
            logger.log('AUDIO_PLAYBACK', '✅ Loaded word timings:', this.wordTimings.length, 'words');
          }
        }
      } else {
        logger.warn('GITHUB_API', 'No message found for current date:', currentDate);
      }
    } catch (error) {
      logger.warn('GITHUB_API', 'Failed to load current message from GitHub:', error);
      logger.warn('GITHUB_API', 'Using fallback message');
      // Keep using the fallback message set in constructor
    }
  }

  /**
   * Spawn particles on wall bounce
   */
  spawnWallParticles(mascotBody, wallBody) {
    const particleConfig = config.walls.particles;
    const mascotPos = mascotBody.position;

    // Determine which wall was hit (left or right)
    const isLeftWall = wallBody.position.x < this.width / 2;
    const impactX = isLeftWall ? config.walls.thickness : this.width - config.walls.thickness;
    const impactY = mascotPos.y;

    // Direction away from wall (perpendicular)
    const directionX = isLeftWall ? 1 : -1;

    // Calculate responsive scale based on mascot radius
    // Mobile (30px radius) = 1.0x, Desktop (45px radius) = 1.5x
    // Apply to both size and velocity for consistent feel across screen sizes
    const scale = this.mascotRadius / 30;

    // Spawn particles
    for (let i = 0; i < particleConfig.count; i++) {
      const spreadAngle = particleConfig.spreadAngle * (Math.PI / 180); // Convert to radians
      const randomAngle = (Math.random() - 0.5) * spreadAngle; // Random angle within spread

      // Base direction (away from wall) + random spread
      const baseAngle = directionX > 0 ? 0 : Math.PI; // 0 = right, PI = left
      const finalAngle = baseAngle + randomAngle;

      // Random velocity magnitude (scaled for responsive sizing)
      const baseSpeed = particleConfig.velocityMin + Math.random() * (particleConfig.velocityMax - particleConfig.velocityMin);
      const speed = baseSpeed * scale;
      const vx = Math.cos(finalAngle) * speed;
      const vy = (Math.random() - 0.5) * speed * 0.5; // Slight vertical variation

      // Random size (scaled by mascot radius for responsive sizing)
      const baseSize = particleConfig.sizeMin + Math.random() * (particleConfig.sizeMax - particleConfig.sizeMin);
      const size = baseSize * scale;

      this.particles.push({
        x: impactX,
        y: impactY,
        vx,
        vy,
        size,
        opacity: 1,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Update particles (physics and fade out)
   */
  updateParticles(delta) {
    const particleConfig = config.walls.particles;
    const currentTime = Date.now();

    // Calculate responsive scale for gravity
    const scale = this.mascotRadius / 30;
    const scaledGravity = particleConfig.gravity * scale;

    // Update each particle
    this.particles = this.particles.filter(particle => {
      const age = currentTime - particle.timestamp;

      // Remove if fully faded
      if (age >= particleConfig.fadeOutMs) {
        return false;
      }

      // Update physics (with scaled gravity)
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += scaledGravity;

      // Update opacity (fade out linearly)
      particle.opacity = 1 - (age / particleConfig.fadeOutMs);

      // Shrink if enabled
      if (particleConfig.shrink) {
        particle.size = particle.size * (1 - (age / particleConfig.fadeOutMs) * 0.5); // Shrink to 50% of original
      }

      return true;
    });
  }

  /**
   * Update wall glows (filter expired)
   */
  updateWallGlows() {
    const glowConfig = config.walls.glow;
    const currentTime = Date.now();

    // Remove fully faded glows
    this.wallGlows = this.wallGlows.filter(glow => {
      const age = currentTime - glow.timestamp;
      return age < glowConfig.fadeOutMs;
    });

    // Remove old bounce ripples
    const rippleDuration = config.physics.mascot.bounceJuice.ripple.duration;
    this.bounceRipples = this.bounceRipples.filter(ripple => {
      const age = currentTime - ripple.timestamp;
      return age < rippleDuration;
    });

  }

  /**
   * Update coin physics (apply gravity and remove expired)
   */
  updateCoins() {
    if (!config.coins.enabled) return;

    const currentTime = Date.now();
    const totalDuration = config.coins.physics.lifetime + config.coins.physics.fadeDuration;
    const gravity = config.coins.physics.gravity;

    // Update physics and remove expired coins
    this.coins = this.coins.filter(coin => {
      const age = currentTime - coin.timestamp;

      // Apply gravity to velocity
      coin.vy += gravity;

      // Update position based on velocity
      coin.x += coin.vx;
      coin.y += coin.vy;

      // Keep coin if not expired
      return age < totalDuration;
    });
  }

  /**
   * Get particles for rendering
   */
  getParticles() {
    return this.particles;
  }

  /**
   * Get coins for rendering with physics-based position and fade
   */
  getCoins() {
    if (!config.coins.enabled) return [];

    const currentTime = Date.now();
    return this.coins.map(coin => {
      const age = currentTime - coin.timestamp;
      let opacity = 1.0;

      // Fade on descent: start fading as soon as coin starts falling (vy > 0)
      if (config.coins.physics.fadeOnDescent && coin.vy > 0) {
        // Fade based on how far into descent we are
        // Map velocity from 0 (peak) to positive (falling) to opacity 1.0 -> 0.0
        opacity = Math.max(0, 1.0 - (coin.vy * config.coins.physics.fadeSpeed));
      }

      // Also apply lifetime-based fade at the end
      const fadeStart = config.coins.physics.lifetime;
      if (age > fadeStart) {
        const fadeProgress = (age - fadeStart) / config.coins.physics.fadeDuration;
        const lifetimeFade = Math.max(0, 1.0 - fadeProgress);
        opacity = Math.min(opacity, lifetimeFade); // Use the lower opacity
      }

      // Calculate horizontal scale for rotation effect (oscillates using sine wave)
      let scaleX = 1.0;
      if (config.coins.rotation.enabled) {
        // Use time-based rotation phase
        const rotationSpeed = config.coins.rotation.speed;
        const currentPhase = coin.rotationPhase + (age * rotationSpeed);

        // Map sine wave (-1 to 1) to scale range (minScale to maxScale)
        const { minScale, maxScale } = config.coins.rotation;
        const normalizedSine = (Math.sin(currentPhase) + 1) / 2; // 0 to 1
        scaleX = minScale + (normalizedSine * (maxScale - minScale));
      }

      // Position is already updated by physics in updateCoins()
      return {
        x: coin.x,
        y: coin.y,
        opacity: opacity,
        scaleX: scaleX,
      };
    });
  }

  /**
   * Get coin count
   */
  getCoinCount() {
    return this.coinCount;
  }

  /**
   * Get wall glows for rendering
   */
  getWallGlows() {
    return this.wallGlows;
  }

  /**
   * Get bounce ripples for rendering
   */
  getBounceRipples() {
    return this.bounceRipples;
  }

  /**
   * Get last bounce scale timestamp
   */
  getLastBounceScale() {
    return this.lastBounceScale;
  }

  /**
   * Get death fade progress (0.0 = visible, 1.0 = fully faded)
   */
  getDeathFadeProgress() {
    return this.deathFadeProgress;
  }

  /**
   * Get death start time (for coin count timing)
   */
  getDeathStartTime() {
    return this.deathStartTime;
  }

  /**
   * Get coin count cutscene active state
   */
  getCoinCountCutsceneActive() {
    return this.coinCountCutsceneActive;
  }

  /**
   * Get coin count cutscene start time
   */
  getCoinCountCutsceneStartTime() {
    return this.coinCountCutsceneStartTime;
  }

  /**
   * Get current stored progress from localStorage
   */
  getProgress() {
    return getProgress();
  }

  /**
   * Get session coin count (coins collected this session)
   */
  getSessionCoinCount() {
    return this.coinCount;
  }

  /**
   * Debug: Add a coin to the session count
   */
  addDebugCoin() {
    if (config.coins.enabled) {
      this.coinCount++;
      const currentTime = Date.now();
      const mascotPos = this.getMascotPosition();
      this.coins.push({
        x: mascotPos.x,
        y: mascotPos.y,
        vx: config.coins.physics.velocityX,
        vy: config.coins.physics.velocityY,
        timestamp: currentTime,
        rotationPhase: Math.random() * Math.PI * 2,
      });
      playSound('pickup-coin');
    }
  }

  /**
   * Get game started state
   */
  getGameStarted() {
    return this.gameStarted;
  }

  /**
   * Get has lost state
   */
  getHasLost() {
    return this.hasLost;
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Clean up audio player
    if (this.audioPlayer) {
      try {
        this.audioPlayer.pause();
        this.audioPlayer = null;
      } catch (error) {
        logger.error('AUDIO_PLAYBACK', 'Failed to cleanup audio:', error);
      }
    }

    Matter.World.clear(this.world);
    Matter.Engine.clear(this.engine);
  }
}
