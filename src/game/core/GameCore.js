import Matter from 'matter-js';
import { config } from '../../config';

/**
 * GameCore - Physics engine using Matter.js
 * Handles all physics simulation, collision detection, and game state
 */
export class GameCore {
  constructor(width, height) {
    // Create Matter.js engine
    this.engine = Matter.Engine.create();
    this.world = this.engine.world;

    // Set gravity from config
    this.engine.gravity.y = config.physics.gravityY;

    // Store dimensions
    this.width = width;
    this.height = height;

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

    // Create ground (static body - for testing)
    const ground = Matter.Bodies.rectangle(
      width / 2,
      height - 25,
      width,
      50,
      {
        isStatic: true,
        label: 'ground',
      }
    );

    Matter.World.add(this.world, ground);

    // Create side walls (static bodies - for testing)
    const leftWall = Matter.Bodies.rectangle(25, height / 2, 50, height, {
      isStatic: true,
      label: 'wall',
    });

    const rightWall = Matter.Bodies.rectangle(width - 25, height / 2, 50, height, {
      isStatic: true,
      label: 'wall',
    });

    Matter.World.add(this.world, [leftWall, rightWall]);

    // Store obstacles for rendering
    this.obstacles = [ground, leftWall, rightWall];

    // Track Gelatos (player-drawn springboards)
    this.gelato = null; // Only one Gelato at a time (maxActiveGelatos = 1)
  }

  /**
   * Update physics simulation
   * Call this every frame with delta time
   */
  step(deltaMs) {
    Matter.Engine.update(this.engine, deltaMs);
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
        restitution: 0.8, // Bouncy!
      }
    );

    Matter.World.add(this.world, this.gelato);

    // Return line data for rendering
    return { startX, startY, endX, endY };
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
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    Matter.World.clear(this.world);
    Matter.Engine.clear(this.engine);
  }
}
