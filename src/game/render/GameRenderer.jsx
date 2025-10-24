import React from 'react';
import { Canvas, Circle, Fill, Line, vec } from '@shopify/react-native-skia';
import { config } from '../../config';

/**
 * GameRenderer - Unified Skia renderer for all platforms
 * This same code works on Web, iOS, and Android
 */
export function GameRenderer({ width, height, mascotX, mascotY, lines = [], currentLine = null }) {
  return (
    <Canvas style={{ width, height }}>
      {/* Background */}
      <Fill color={config.visuals.backgroundColor} />

      {/* Draw all completed lines */}
      {lines.map((line, index) => (
        <Line
          key={index}
          p1={vec(line.startX, line.startY)}
          p2={vec(line.endX, line.endY)}
          color="white"
          style="stroke"
          strokeWidth={config.gelato.thickness}
        />
      ))}

      {/* Draw current line being drawn */}
      {currentLine && (
        <Line
          p1={vec(currentLine.startX, currentLine.startY)}
          p2={vec(currentLine.endX, currentLine.endY)}
          color="rgba(255, 255, 255, 0.5)"
          style="stroke"
          strokeWidth={config.gelato.thickness}
        />
      )}

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
