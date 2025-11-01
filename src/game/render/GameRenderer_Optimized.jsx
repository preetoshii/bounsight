import React, { useEffect, useRef } from 'react';
import { Canvas, Circle, Fill, Line, Rect, vec, DashPathEffect, Path, Skia, Group, Text as SkiaText, matchFont } from '@shopify/react-native-skia';
import { View, StyleSheet } from 'react-native';
import { config } from '../../config';

/**
 * OPTIMIZED GameRenderer - If you see FPS drops with wave text
 * This version renders text INSIDE Skia Canvas for better performance
 * Replace GameRenderer.jsx with this if you see jitter during word reveals
 */
export function GameRenderer({ width, height, mascotX, mascotY, obstacles = [], lines = [], currentPath = null, bounceImpact = null, gelatoCreationTime = null, currentWord = null, mascotVelocityY = 0, squashStretch = { scaleX: 1, scaleY: 1 } }) {
  // Calculate word opacity based on configured fade mode
  let wordOpacity = 0;

  if (currentWord) {
    if (config.visuals.wordFadeMode === 'velocity') {
      // Velocity-based fade: opacity synced 1:1 with ball motion
      if (currentWord.initialVelocityY !== undefined) {
        const velocityRange = Math.abs(currentWord.initialVelocityY);
        const velocityChange = mascotVelocityY - currentWord.initialVelocityY;
        const fadeProgress = Math.min(1, Math.max(0, velocityChange / (velocityRange * 2)));
        wordOpacity = 1 - fadeProgress;
      }
    } else if (config.visuals.wordFadeMode === 'static') {
      // Static/time-based fade
      const timeSinceReveal = Date.now() - currentWord.timestamp;
      const fadeInDuration = config.visuals.wordFadeInMs;
      const persistDuration = config.visuals.wordPersistMs;
      const fadeOutDuration = config.visuals.wordFadeOutMs;

      if (timeSinceReveal < fadeInDuration) {
        wordOpacity = timeSinceReveal / fadeInDuration;
      } else if (timeSinceReveal < fadeInDuration + persistDuration) {
        wordOpacity = 1;
      } else if (timeSinceReveal < fadeInDuration + persistDuration + fadeOutDuration) {
        const fadeOutProgress = (timeSinceReveal - fadeInDuration - persistDuration) / fadeOutDuration;
        wordOpacity = 1 - fadeOutProgress;
      } else {
        wordOpacity = 0;
      }
    }
  }

  // Calculate word vertical offset
  let wordVerticalOffset = 0;
  if (currentWord && currentWord.initialVelocityY !== undefined) {
    const maxOffset = 50;
    const velocityRange = Math.abs(currentWord.initialVelocityY);
    const normalizedVelocity = Math.max(-1, Math.min(1, mascotVelocityY / velocityRange));
    wordVerticalOffset = normalizedVelocity * maxOffset;
  }

  // Calculate wave animation for each letter (inside Skia for performance)
  let letterTransforms = [];
  if (currentWord) {
    const letters = currentWord.text.split('');
    const timeSinceReveal = Date.now() - currentWord.timestamp;

    letterTransforms = letters.map((letter, index) => {
      const delayBetweenLetters = 60;
      const initialDelay = index * delayBetweenLetters;
      const animDuration = 300; // Total wave duration (up + down)
      const halfDuration = animDuration / 2;

      // Calculate wave progress for this letter
      const letterTime = timeSinceReveal - initialDelay;

      let translateY = 0;
      let scale = 1;

      if (letterTime > 0 && letterTime < animDuration) {
        if (letterTime < halfDuration) {
          // Wave up
          const progress = letterTime / halfDuration;
          const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
          translateY = -8 * eased;
          scale = 1 + 0.08 * eased;
        } else {
          // Wave down
          const progress = (letterTime - halfDuration) / halfDuration;
          const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
          translateY = -8 * (1 - eased);
          scale = 1 + 0.08 * (1 - eased);
        }
      }

      return { letter, translateY, scale };
    });
  }

  // Load custom font for Skia text (FinlandRounded)
  const font = matchFont({
    fontFamily: 'FinlandRounded',
    fontSize: config.visuals.wordFontSize,
    fontWeight: 'normal',
  });

  return (
    <View style={{ width, height, position: 'relative' }}>
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

            // Calculate fade out opacity
            const fadeProgress = Math.min(timeSinceBounce / fadeOutDuration, 1);
            const opacity = 1 - fadeProgress;

            // Apply deformation if still within deformation duration
            if (timeSinceBounce < deformConfig.duration) {
              const progress = timeSinceBounce / deformConfig.duration;
              const frequency = deformConfig.frequency * Math.PI * 2;
              const dampingFactor = Math.exp(-deformConfig.damping * progress * 5);
              const oscillation = Math.sin(frequency * progress) * dampingFactor;

              const impactStrength = Math.min(bounceImpact.strength / 10, 1);
              const bendAmount = deformConfig.maxBendAmount * oscillation * impactStrength;

              const dx = line.endX - line.startX;
              const dy = line.endY - line.startY;
              const lineLength = Math.sqrt(dx * dx + dy * dy);

              const impactDx = bounceImpact.x - line.startX;
              const impactDy = bounceImpact.y - line.startY;
              const t = Math.max(0, Math.min(1, (impactDx * dx + impactDy * dy) / (lineLength * lineLength)));

              const bendX = line.startX + dx * t;
              const bendY = line.startY + dy * t;

              const perpX = -dy / lineLength;
              const perpY = dx / lineLength;

              const displacedX = bendX + perpX * bendAmount;
              const displacedY = bendY + perpY * bendAmount;

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

            // Still fading but no longer deforming
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
              const progress = timeSinceCreation / creationConfig.duration;
              const frequency = creationConfig.frequency * Math.PI * 2;
              const dampingFactor = Math.exp(-creationConfig.damping * progress * 5);
              const oscillation = Math.sin(frequency * progress) * dampingFactor;
              const bendAmount = creationConfig.maxBendAmount * oscillation;

              const dx = line.endX - line.startX;
              const dy = line.endY - line.startY;
              const lineLength = Math.sqrt(dx * dx + dy * dy);

              const centerX = line.startX + dx * 0.5;
              const centerY = line.startY + dy * 0.5;

              const perpX = -dy / lineLength;
              const perpY = dx / lineLength;

              const displacedX = centerX + perpX * bendAmount;
              const displacedY = centerY + perpY * bendAmount;

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

        {/* Mascot circle with squash and stretch */}
        <Group
          transform={[
            { translateX: mascotX },
            { translateY: mascotY },
            { scaleX: squashStretch.scaleX },
            { scaleY: squashStretch.scaleY },
            { translateX: -mascotX },
            { translateY: -mascotY },
          ]}
        >
          <Circle
            cx={mascotX}
            cy={mascotY}
            r={config.physics.mascot.radius}
            color="white"
            style="stroke"
            strokeWidth={2}
          />
        </Group>

        {/* OPTIMIZED: Render text inside Skia Canvas with wave animation */}
        {currentWord && wordOpacity > 0 && letterTransforms.length > 0 && (
          <Group opacity={wordOpacity}>
            {letterTransforms.map((letterData, index) => {
              // Calculate x position for this letter (center text horizontally)
              const letterSpacing = config.visuals.wordFontSize * 0.6; // Approximate letter width
              const totalWidth = letterTransforms.length * letterSpacing;
              const startX = (width - totalWidth) / 2;
              const letterX = startX + index * letterSpacing;
              const letterY = height / 2 + wordVerticalOffset;

              return (
                <Group
                  key={`${currentWord.text}-${index}`}
                  transform={[
                    { translateX: letterX },
                    { translateY: letterY },
                    { scale: letterData.scale },
                    { translateY: letterData.translateY },
                    { translateX: -letterX },
                    { translateY: -letterY },
                  ]}
                >
                  <SkiaText
                    x={letterX}
                    y={letterY}
                    text={letterData.letter}
                    font={font}
                    color={config.visuals.wordColor}
                  />
                </Group>
              );
            })}
          </Group>
        )}
      </Canvas>
    </View>
  );
}

