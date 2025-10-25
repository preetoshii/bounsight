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

    // Create mascot (dynamic body - affected by gravity)
    this.mascot = Matter.Bodies.circle(
      width / 2,
      100,
      config.physics.mascot.radius,
      {
        restitution: config.physics.mascot.restitution,
        friction: config.physics.mascot.friction,
        frictionAir: config.physics.mascot.frictionAir,
        mass: config.physics.mascot.mass,
        label: 'mascot',
      }
    );

    Matter.World.add(this.world, this.mascot);

    // Create boundary walls using config
    const wallThickness = config.walls.thickness;
    const halfThickness = wallThickness / 2;

    // Ground (bottom boundary)
    const ground = Matter.Bodies.rectangle(
      width / 2,
      height - halfThickness,
      width,
      wallThickness,
      {
        isStatic: true,
        label: 'ground',
        restitution: config.walls.restitution,
      }
    );

    // Side walls
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

    Matter.World.add(this.world, [ground, leftWall, rightWall]);

    // Store obstacles for rendering
    this.obstacles = [ground, leftWall, rightWall];

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
   * Set message (for preview mode)
   */
  setMessage(messageText) {
    if (messageText) {
      this.message = messageText.toLowerCase().split(/\s+/);
      this.wordIndex = 0;
      this.currentWord = null;
    }
  }

  /**
   * Reset to default message
   */
  resetMessage() {
    this.message = [
      "you", "are", "loved", "beyond", "measure",
      "and", "nothing", "can", "change", "that"
    ];
    this.wordIndex = 0;
    this.currentWord = null;
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

    // Create new boundaries with new dimensions
    const wallThickness = config.walls.thickness;
    const halfThickness = wallThickness / 2;

    const ground = Matter.Bodies.rectangle(
      width / 2,
      height - halfThickness,
      width,
      wallThickness,
      {
        isStatic: true,
        label: 'ground',
        restitution: config.walls.restitution,
      }
    );

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

    Matter.World.add(this.world, [ground, leftWall, rightWall]);
    this.obstacles = [ground, leftWall, rightWall];
  }

  /**
   * Clean up resources
   */
  destroy() {
    Matter.World.clear(this.world);
    Matter.Engine.clear(this.engine);
  }
}
