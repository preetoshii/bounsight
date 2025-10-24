import React from 'react';
import { Canvas, Circle, Fill } from '@shopify/react-native-skia';
import { config } from '../../config';

/**
 * GameRenderer - Unified Skia renderer for all platforms
 * This same code works on Web, iOS, and Android
 */
export function GameRenderer({ width, height, mascotX, mascotY }) {
  return (
    <Canvas style={{ width, height }}>
      {/* Background */}
      <Fill color={config.visuals.backgroundColor} />

      {/* Test mascot circle */}
      <Circle
        cx={mascotX}
        cy={mascotY}
        r={config.physics.mascot.radius}
        color="#69e"
      />
    </Canvas>
  );
}
