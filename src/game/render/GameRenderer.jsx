import React from 'react';
import { Canvas, Circle, Fill, Line, Rect, vec, DashPathEffect, Path, Skia } from '@shopify/react-native-skia';
import { config } from '../../config';

/**
 * GameRenderer - Unified Skia renderer for all platforms
 * This same code works on Web, iOS, and Android
 */
export function GameRenderer({ width, height, mascotX, mascotY, obstacles = [], lines = [], currentPath = null }) {
  return (
    <Canvas style={{ width, height }}>
      {/* Background */}
      <Fill color={config.visuals.backgroundColor} />

      {/* Draw obstacles (ground and walls) */}
      {obstacles.map((obstacle, index) => (
        <Rect
          key={index}
          x={obstacle.x - obstacle.width / 2}
          y={obstacle.y - obstacle.height / 2}
          width={obstacle.width}
          height={obstacle.height}
          color="#333"
        />
      ))}

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

      {/* Draw current path being drawn (dotted curved preview) */}
      {currentPath && currentPath.length >= 2 && (() => {
        const path = Skia.Path.Make();
        path.moveTo(currentPath[0].x, currentPath[0].y);
        for (let i = 1; i < currentPath.length; i++) {
          path.lineTo(currentPath[i].x, currentPath[i].y);
        }
        return (
          <Path
            path={path}
            color="rgba(255, 255, 255, 0.6)"
            style="stroke"
            strokeWidth={config.gelato.thickness}
            strokeCap="round"
          >
            <DashPathEffect intervals={[1, 15]} />
          </Path>
        );
      })()}

      {/* Mascot circle (now physics-based!) */}
      <Circle
        cx={mascotX}
        cy={mascotY}
        r={config.physics.mascot.radius}
        color="#69e"
      />
    </Canvas>
  );
}
