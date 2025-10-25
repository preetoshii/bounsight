import Matter from 'matter-js';
import { config } from '../../config';

/**
 * GameCore - Physics engine using Matter.js
 * Handles all physics simulation, collision detection, and game state
 */
export class GameCore {
  constructor(width, height, customMessage = null) {
    // Create Matter.js engine
    this.engine = Matter.Engine.create();
    this.world = this.engine.world;

    // Set gravity from config
    this.engine.gravity.y = config.physics.gravityY;

    // Store dimensions
    this.width = width;
    this.height = height;

    // Store custom message for preview mode
    this.customMessage = customMessage;

    // Store target position for entrance animation
    this.mascotTargetY = height * 0.25; // 25% from top = 75% near top

    // Create mascot (starts above screen for entrance animation)
    this.mascot = Matter.Bodies.circle(
      width / 2,
      -config.physics.mascot.radius * 2, // Start above screen
      config.physics.mascot.radius,
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

    // Message system (Milestone 3)
    // Use custom message if provided (for preview mode), otherwise use default
    if (customMessage) {
      this.message = customMessage.toLowerCase().split(/\s+/);
    } else {
      this.message = [
        "you", "are", "loved", "beyond", "measure",
        "and", "nothing", "can", "change", "that"
      ]; // Hardcoded test message
    }
    this.wordIndex = 0; // Current word in message
    this.currentWord = null; // Currently displayed word { text, timestamp }

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
    // Disable gravity before game starts (manual position control)
    if (!this.gameStarted) {
      Matter.Body.setVelocity(this.mascot, { x: 0, y: 0 });
    }

    // Check for loss (ball fell below screen)
    if (this.gameStarted && !this.hasLost && this.mascot.position.y > this.height + config.physics.mascot.radius * 2) {
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

      const startY = -config.physics.mascot.radius * 2;
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

    Matter.Engine.update(this.engine, deltaMs);

    // Apply velocity capping (safety valve)
    const velocity = this.mascot.velocity;
    if (Math.abs(velocity.x) > config.physics.maxVelocityX) {
      Matter.Body.setVelocity(this.mascot, {
        x: Math.sign(velocity.x) * config.physics.maxVelocityX,
        y: velocity.y,
      });
    }
    if (Math.abs(velocity.y) > config.physics.maxVelocityY) {
      Matter.Body.setVelocity(this.mascot, {
        x: velocity.x,
        y: Math.sign(velocity.y) * config.physics.maxVelocityY,
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
   * Handle loss (ball fell off screen)
   */
  handleLoss() {
    this.hasLost = true;

    // Reset word index to start message from beginning
    this.wordIndex = 0;
    this.currentWord = null;

    // Remove any existing gelato
    if (this.gelato) {
      Matter.World.remove(this.world, this.gelato);
      this.gelato = null;
      this.gelatoLineData = null;
      this.bounceImpact = null;
    }

    // Reset ball to starting position (above screen)
    Matter.Body.setPosition(this.mascot, {
      x: this.width / 2,
      y: -config.physics.mascot.radius * 2,
    });

    // Clear velocity (gravity will be disabled by !gameStarted check)
    Matter.Body.setVelocity(this.mascot, { x: 0, y: 0 });

    // Reset entrance animation
    this.entranceStartTime = Date.now();
    this.entranceComplete = false;
    this.idleFloatStartTime = null;
    this.gameStarted = false;
    this.hasLost = false;
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

        // Apply spring boost perpendicular to Gelato
        const angle = gelatoBody.angle;
        const normalX = -Math.sin(angle); // Perpendicular to line
        const normalY = Math.cos(angle);

        // Calculate how hard the ball is hitting the Gelato (dot product)
        const currentVelocity = mascotBody.velocity;
        const impactSpeed = currentVelocity.x * normalX + currentVelocity.y * normalY;

        // Apply trampoline effect: reflect velocity across normal and amplify
        // Remove the component moving INTO the gelato and add it back multiplied
        const boostVelocity = -impactSpeed * (1 + config.gelato.springBoost);

        Matter.Body.setVelocity(mascotBody, {
          x: currentVelocity.x + normalX * boostVelocity,
          y: currentVelocity.y + normalY * boostVelocity,
        });

        // Store impact data for visual deformation
        this.bounceImpact = {
          x: mascotBody.position.x,
          y: mascotBody.position.y,
          strength: Math.abs(impactSpeed),
          timestamp: currentTime,
        };

        // Reveal next word (Milestone 3)
        this.revealNextWord();
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
   * Create a Gelato (springboard) from a drawn line
   * Returns the line data if created, null if max length exceeded
   */
  createGelato(startX, startY, endX, endY) {
    // Start the game on first gelato creation
    if (!this.gameStarted) {
      this.gameStarted = true;
      // Ball is already dynamic, just enable physics by allowing gravity
    }

    // Check max length constraint
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length > config.gelato.maxLength) {
      // Clamp to max length
      const scale = config.gelato.maxLength / length;
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
    const angle = Math.atan2(endY - startY, endX - startX);
    const gelatoLength = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);

    // Create static rectangular body for the Gelato
    this.gelato = Matter.Bodies.rectangle(
      centerX,
      centerY,
      gelatoLength,
      config.gelato.thickness,
      {
        isStatic: true,
        angle: angle,
        label: 'gelato',
        restitution: 0.1, // Low restitution - we handle bounce in collision handler
      }
    );

    Matter.World.add(this.world, this.gelato);

    // Store line data for rendering
    this.gelatoLineData = { startX, startY, endX, endY };

    // Track creation time for pop-in animation
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
   * Get current Y velocity of mascot
   */
  getMascotVelocityY() {
    return this.mascot.velocity.y;
  }

  /**
   * Get Gelato line data for rendering
   */
  getGelatoLineData() {
    return this.gelatoLineData;
  }

  /**
   * Update boundaries when screen size changes
   */
  updateBoundaries(width, height) {
    this.width = width;
    this.height = height;

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
   * Clean up resources
   */
  destroy() {
    Matter.World.clear(this.world);
    Matter.Engine.clear(this.engine);
  }
}
