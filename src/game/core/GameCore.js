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
   * Clean up resources
   */
  destroy() {
    Matter.World.clear(this.world);
    Matter.Engine.clear(this.engine);
  }
}
