import React from 'react';
import { Canvas, Circle, Fill, Line, Rect, vec, DashPathEffect, Path, Skia } from '@shopify/react-native-skia';
import { config } from '../../config';

/**
 * GameRenderer - Unified Skia renderer for all platforms
 * This same code works on Web, iOS, and Android
 */
export function GameRenderer({ width, height, mascotX, mascotY, obstacles = [], lines = [], currentPath = null, bounceImpact = null, gelatoCreationTime = null }) {
  return (
    <Canvas style={{ width, height }}>
      {/* Background */}
      <Fill color={config.visuals.backgroundColor} />

      {/* Draw obstacles (walls/ground) if visible in config */}
      {config.walls.visible && obstacles.map((obstacle, index) => (
        <Rect
          key={index}
          x={obstacle.x - obstacle.width / 2}
          y={obstacle.y - obstacle.height / 2}
          width={obstacle.width}
          height={obstacle.height}
          color="#333"
        />
      ))}

      {/* Draw all completed lines (Gelatos) with deformation effect */}
      {lines.map((line, index) => {
        // Check if we should apply deformation or fade to this line
        if (bounceImpact && bounceImpact.timestamp) {
          const timeSinceBounce = Date.now() - bounceImpact.timestamp;
          const deformConfig = config.gelato.deformation;
          const fadeOutDuration = config.gelato.fadeOutDuration;

          // Calculate fade out opacity (independent of deformation)
          const fadeProgress = Math.min(timeSinceBounce / fadeOutDuration, 1);
          const opacity = 1 - fadeProgress;

          // Apply deformation if still within deformation duration
          if (timeSinceBounce < deformConfig.duration) {
            // Calculate progress through the animation (0 to 1)
            const progress = timeSinceBounce / deformConfig.duration;

            // Apply oscillation with exponential decay (real spring physics)
            const frequency = deformConfig.frequency * Math.PI * 2;
            const dampingFactor = Math.exp(-deformConfig.damping * progress * 5); // Exponential decay
            const oscillation = Math.sin(frequency * progress) * dampingFactor;

            // Calculate bend amount with oscillation
            const impactStrength = Math.min(bounceImpact.strength / 10, 1);
            const bendAmount = deformConfig.maxBendAmount * oscillation * impactStrength;

            // Find the point on the line closest to impact
            const dx = line.endX - line.startX;
            const dy = line.endY - line.startY;
            const lineLength = Math.sqrt(dx * dx + dy * dy);

            // Project impact point onto line
            const impactDx = bounceImpact.x - line.startX;
            const impactDy = bounceImpact.y - line.startY;
            const t = Math.max(0, Math.min(1, (impactDx * dx + impactDy * dy) / (lineLength * lineLength)));

            // Calculate bend point (middle of line, displaced perpendicular)
            const bendX = line.startX + dx * t;
            const bendY = line.startY + dy * t;

            // Perpendicular direction (for bending)
            const perpX = -dy / lineLength;
            const perpY = dx / lineLength;

            // Apply bend displacement
            const displacedX = bendX + perpX * bendAmount;
            const displacedY = bendY + perpY * bendAmount;

            // Draw curved line using quadratic bezier
            const path = Skia.Path.Make();
            path.moveTo(line.startX, line.startY);
            path.quadTo(displacedX, displacedY, line.endX, line.endY);

            return (
              <Path
                key={index}
                path={path}
                color={`rgba(255, 255, 255, ${opacity})`}
                style="stroke"
                strokeWidth={config.gelato.thickness}
              />
            );
          }

          // Still fading but no longer deforming - draw straight line with fade
          return (
            <Line
              key={index}
              p1={vec(line.startX, line.startY)}
              p2={vec(line.endX, line.endY)}
              color={`rgba(255, 255, 255, ${opacity})`}
              style="stroke"
              strokeWidth={config.gelato.thickness}
            />
          );
        }

        // Check for creation animation (pop-in effect)
        if (gelatoCreationTime) {
          const timeSinceCreation = Date.now() - gelatoCreationTime;
          const creationConfig = config.gelato.creation;

          if (timeSinceCreation < creationConfig.duration) {
            // Calculate progress through creation animation
            const progress = timeSinceCreation / creationConfig.duration;

            // Apply oscillation from center with exponential decay
            const frequency = creationConfig.frequency * Math.PI * 2;
            const dampingFactor = Math.exp(-creationConfig.damping * progress * 5); // Exponential decay
            const oscillation = Math.sin(frequency * progress) * dampingFactor;

            // Bend amount for creation
            const bendAmount = creationConfig.maxBendAmount * oscillation;

            // Calculate center point and perpendicular direction
            const dx = line.endX - line.startX;
            const dy = line.endY - line.startY;
            const lineLength = Math.sqrt(dx * dx + dy * dy);

            // Bend at center (t = 0.5)
            const centerX = line.startX + dx * 0.5;
            const centerY = line.startY + dy * 0.5;

            // Perpendicular direction
            const perpX = -dy / lineLength;
            const perpY = dx / lineLength;

            // Apply bend displacement from center
            const displacedX = centerX + perpX * bendAmount;
            const displacedY = centerY + perpY * bendAmount;

            // Draw curved line
            const path = Skia.Path.Make();
            path.moveTo(line.startX, line.startY);
            path.quadTo(displacedX, displacedY, line.endX, line.endY);

            return (
              <Path
                key={index}
                path={path}
                color="white"
                style="stroke"
                strokeWidth={config.gelato.thickness}
              />
            );
          }
        }

        // No animation - draw normal line
        return (
          <Line
            key={index}
            p1={vec(line.startX, line.startY)}
            p2={vec(line.endX, line.endY)}
            color="white"
            style="stroke"
            strokeWidth={config.gelato.thickness}
          />
        );
      })}

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
        color="white"
        style="stroke"
        strokeWidth={2}
      />
    </Canvas>
  );
}
