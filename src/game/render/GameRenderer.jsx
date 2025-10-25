import React, { useEffect, useRef } from 'react';
import { Canvas, Circle, Fill, Line, Rect, vec, DashPathEffect, Path, Skia, Group } from '@shopify/react-native-skia';
import { Text, View, StyleSheet, Animated } from 'react-native';
import { config } from '../../config';

// Load Inter font (clean, geometric, open-source)
if (typeof document !== 'undefined') {
  const link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400&display=swap';
  link.rel = 'stylesheet';
  document.head.appendChild(link);
}

/**
 * WaveText - Mexican wave effect where each letter waves in sequence
 */
function WaveText({ text, opacity }) {
  const letters = text.split('');
  const totalLetters = letters.length;

  return (
    <View style={{ flexDirection: 'row', opacity }}>
      {letters.map((letter, index) => (
        <WaveLetter key={`${text}-${index}`} letter={letter} index={index} totalLetters={totalLetters} />
      ))}
    </View>
  );
}

/**
 * WaveLetter - Individual letter with wave animation
 */
function WaveLetter({ letter, index, totalLetters }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Stagger the animation based on letter index
    const delayBetweenLetters = 60; // 60ms delay between each letter (faster wave)
    const initialDelay = index * delayBetweenLetters;

    // Wave only once on reveal - no loop!
    const waveAnimation = Animated.sequence([
      // Wait for this letter's turn
      Animated.delay(initialDelay),
      // Wave up (subtle and fast)
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -8,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.08,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
      // Wave down (subtle and fast)
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]);

    waveAnimation.start();

    return () => waveAnimation.stop();
  }, [index, totalLetters]);

  return (
    <Animated.Text
      style={[
        styles.word,
        {
          transform: [
            { translateY },
            { scale },
          ],
        },
      ]}
    >
      {letter === ' ' ? '\u00A0' : letter}
    </Animated.Text>
  );
}

/**
 * GameRenderer - Unified Skia renderer for all platforms
 * This same code works on Web, iOS, and Android
 */
export function GameRenderer({ width, height, mascotX, mascotY, obstacles = [], lines = [], currentPath = null, bounceImpact = null, gelatoCreationTime = null, currentWord = null, mascotVelocityY = 0, squashStretch = { scaleX: 1, scaleY: 1 } }) {
  // Calculate word opacity based on configured fade mode
  let wordOpacity = 0;

  if (currentWord) {
    if (config.visuals.wordFadeMode === 'velocity') {
      // Velocity-based fade: opacity synced 1:1 with ball motion
      if (currentWord.initialVelocityY !== undefined) {
        // At bounce: initialVelocityY is negative (upward)
        // As ball falls: velocityY increases toward positive (downward)
        // Fade from 100% to 0% as velocity goes from initial (negative) to 0 (peak) to positive
        const velocityRange = Math.abs(currentWord.initialVelocityY);
        const velocityChange = mascotVelocityY - currentWord.initialVelocityY;

        // Normalize velocity change: 0 at bounce, 1 when velocity reverses completely
        const fadeProgress = Math.min(1, Math.max(0, velocityChange / (velocityRange * 2)));
        wordOpacity = 1 - fadeProgress;
      }
    } else if (config.visuals.wordFadeMode === 'static') {
      // Static/time-based fade: three-phase animation (fade-in, persist, fade-out)
      const timeSinceReveal = Date.now() - currentWord.timestamp;
      const fadeInDuration = config.visuals.wordFadeInMs;
      const persistDuration = config.visuals.wordPersistMs;
      const fadeOutDuration = config.visuals.wordFadeOutMs;

      if (timeSinceReveal < fadeInDuration) {
        // Phase 1: Fade in from 0% → 100%
        wordOpacity = timeSinceReveal / fadeInDuration;
      } else if (timeSinceReveal < fadeInDuration + persistDuration) {
        // Phase 2: Stay at 100%
        wordOpacity = 1;
      } else if (timeSinceReveal < fadeInDuration + persistDuration + fadeOutDuration) {
        // Phase 3: Fade out from 100% → 0%
        const fadeOutProgress = (timeSinceReveal - fadeInDuration - persistDuration) / fadeOutDuration;
        wordOpacity = 1 - fadeOutProgress;
      } else {
        // Fully faded out
        wordOpacity = 0;
      }
    }
  }

  // Calculate word vertical offset - DIRECT 1:1 mapping with velocity
  // Negative velocity (up) = negative offset (up), positive velocity (down) = positive offset (down)
  let wordVerticalOffset = 0;
  if (currentWord && currentWord.initialVelocityY !== undefined) {
    const maxOffset = 50; // Maximum offset in either direction
    const velocityRange = Math.abs(currentWord.initialVelocityY);

    // Direct analog mapping: velocity -20 to +20 maps to offset -50 to +50
    // Velocity negative (up) → offset negative (up), velocity positive (down) → offset positive (down)
    const normalizedVelocity = Math.max(-1, Math.min(1, mascotVelocityY / velocityRange));
    wordVerticalOffset = normalizedVelocity * maxOffset;

    console.log('Velocity:', mascotVelocityY.toFixed(2), '→ Offset:', wordVerticalOffset.toFixed(2));
  }

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

      {/* Mascot circle (now physics-based with squash and stretch!) */}
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

      </Canvas>

      {/* Word overlay with Mexican wave animation */}
      {currentWord && wordOpacity > 0 && (
        <View
          style={[
            styles.wordContainer,
            { transform: [{ translateY: wordVerticalOffset }] }
          ]}
          pointerEvents="none"
        >
          <WaveText text={currentWord.text} opacity={wordOpacity} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wordContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  word: {
    fontFamily: 'FinlandRounded',
    fontSize: config.visuals.wordFontSize,
    color: config.visuals.wordColor,
    letterSpacing: 1,
  },
});
