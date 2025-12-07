import React, { useEffect, useRef, memo, useMemo } from 'react';
import { Canvas, Circle, Fill, Line, Rect, RoundedRect, vec, DashPathEffect, Path, Skia, Group, Oval, Blur, LinearGradient } from '@shopify/react-native-skia';
import { Text, View, StyleSheet, Animated } from 'react-native';
import { config } from '../../config';
// Wall glow feature added
// Load Inter font (clean, geometric, open-source)
if (typeof document !== 'undefined') {
  const link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400&display=swap';
  link.rel = 'stylesheet';
  document.head.appendChild(link);
}

/**
 * StarShape - Renders a 4-pointed star
 * @param {number} cx - Center X position
 * @param {number} cy - Center Y position
 * @param {number} size - Size of the star (radius from center to point)
 * @param {string} color - Star color
 * @param {number} opacity - Star opacity
 */
function StarShape({ cx, cy, size, color, opacity }) {
  const path = Skia.Path.Make();
  const { starShape, armThickness } = config.parallax;
  
  if (starShape === 'diamond') {
    // 4-pointed diamond star (classic star shape)
    const outerLength = size;
    const innerLength = size * armThickness;
    
    // Draw diamond with 4 points (top, right, bottom, left)
    path.moveTo(cx, cy - outerLength);              // Top point
    path.lineTo(cx + innerLength, cy - innerLength); // Top-right corner
    path.lineTo(cx + outerLength, cy);              // Right point
    path.lineTo(cx + innerLength, cy + innerLength); // Bottom-right corner
    path.lineTo(cx, cy + outerLength);              // Bottom point
    path.lineTo(cx - innerLength, cy + innerLength); // Bottom-left corner
    path.lineTo(cx - outerLength, cy);              // Left point
    path.lineTo(cx - innerLength, cy - innerLength); // Top-left corner
    path.close();
  } else {
    // Plus/cross shape (default)
    const outerLength = size;
    const innerWidth = size * armThickness;
    
    // Vertical bar
    path.moveTo(cx - innerWidth, cy - outerLength);
    path.lineTo(cx + innerWidth, cy - outerLength);
    path.lineTo(cx + innerWidth, cy + outerLength);
    path.lineTo(cx - innerWidth, cy + outerLength);
    path.close();
    
    // Horizontal bar
    path.moveTo(cx - outerLength, cy - innerWidth);
    path.lineTo(cx + outerLength, cy - innerWidth);
    path.lineTo(cx + outerLength, cy + innerWidth);
    path.lineTo(cx - outerLength, cy + innerWidth);
    path.close();
  }
  
  return (
    <Path
      path={path}
      color={color}
      opacity={opacity}
    />
  );
}

/**
 * WaveText - Mexican wave effect where each letter waves in sequence
 * Auto-scales font size to fit within screen width
 */
function WaveText({ text, opacity, color, screenWidth }) {
  const letters = text.split('');
  const totalLetters = letters.length;

  // Calculate dynamic font size based on text width
  const baseFontSize = config.visuals.wordFontSize;
  const maxWidthPercent = config.visuals.wordMaxWidthPercent;

  // Estimate text width (rough approximation: 0.6 * fontSize per character on average)
  // This is a heuristic - actual rendering may vary slightly by font
  const estimatedTextWidth = text.length * baseFontSize * 0.6;
  const maxAllowedWidth = screenWidth * (maxWidthPercent / 100);

  // Scale down font size if text would exceed max width
  const scaleFactor = estimatedTextWidth > maxAllowedWidth
    ? maxAllowedWidth / estimatedTextWidth
    : 1;
  const finalFontSize = baseFontSize * scaleFactor;

  return (
    <View style={{ flexDirection: 'row', opacity }}>
      {letters.map((letter, index) => (
        <WaveLetter
          key={`${text}-${index}`}
          letter={letter}
          index={index}
          totalLetters={totalLetters}
          color={color}
          fontSize={finalFontSize}
        />
      ))}
    </View>
  );
}

/**
 * WaveLetter - Individual letter with wave animation
 */
function WaveLetter({ letter, index, totalLetters, color, fontSize }) {
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
          fontSize: fontSize,
          color: color,
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
 * ZogChanFace - Renders the ZogChan face from dzog-chan
 * Based on the SVG paths from zog-chan-face.svg and zog-chan-speak.svg
 */
function ZogChanFace({ x, y, color, isSpeaking, radius }) {
  // Scale factor to fit face inside ball
  // Original SVG is 71x68, scale to fit in ball
  const faceScale = (radius * 0.5) / 35.5; // Scale to ~50% of ball radius (medium size)
  const faceWidth = 71 * faceScale;
  const faceHeight = 68 * faceScale;
  
  // Center the face in the ball
  const faceX = x - faceWidth / 2;
  const faceY = y - faceHeight / 2;
  
  return (
    <Group transform={[{ translateX: faceX }, { translateY: faceY }, { scale: faceScale }]}>
      {/* Left eyebrow */}
      <Path
        path={(() => {
          const p = Skia.Path.Make();
          p.moveTo(2, 11.5946);
          p.quadTo(6.16667, 8.59463, 16.4, 4.39463);
          p.quadTo(24, 11.5946, 30, 17.0937);
          p.quadTo(30, 27.0938, 30, 31.5938);
          return p;
        })()}
        color={color}
        style="stroke"
        strokeWidth={3}
        strokeCap="round"
      />
      
      {/* Right eyebrow */}
      <Path
        path={(() => {
          const p = Skia.Path.Make();
          p.moveTo(69.0002, 13.0947);
          p.quadTo(66.8335, 10.7613, 61.1002, 6.29467);
          p.quadTo(55.5002, 7.09467, 48.5002, 8.09467);
          p.quadTo(41.5002, 16.5938, 41.0002, 23.5938);
          p.quadTo(40.6002, 29.1937, 40.8335, 33.5938);
          p.quadTo(41.0002, 35.0938, 41.0002, 35.0938);
          return p;
        })()}
        color={color}
        style="stroke"
        strokeWidth={3}
        strokeCap="round"
      />
      
      {/* Nose */}
      <Path
        path={(() => {
          const p = Skia.Path.Make();
          p.moveTo(25, 42);
          p.quadTo(25.7755, 44.2618, 26.5511, 45.8183);
          p.quadTo(30.0403, 47.0587, 36.0594, 49.1983);
          p.quadTo(42.0617, 47.764, 44, 42);
          return p;
        })()}
        color={color}
        style="stroke"
        strokeWidth={3}
        strokeCap="round"
      />
      
      {/* Mouth - changes when speaking */}
      <Path
        path={(() => {
          const p = Skia.Path.Make();
          // Mouth shape (same for both, but could animate)
          p.moveTo(28.5459, 54.0555);
          p.quadTo(26.5446, 54.5504, 19.5277, 61.0321);
          p.quadTo(20.0265, 61.5332, 20.5252, 62.0344);
          p.quadTo(49.526, 61.704, 50.5275, 61.2067);
          p.quadTo(51.5289, 60.7095, 41.5445, 54.5895);
          p.quadTo(40.0458, 54.0852, 39.3023, 53.835);
          p.quadTo(37.0431, 55.0781, 34.5431, 55.0708);
          p.quadTo(32.0431, 55.0634, 29.5542, 53.8062);
          p.quadTo(28.5459, 54.0555, 28.5459, 54.0555);
          p.close();
          return p;
        })()}
        color={color}
        style="fill"
      />
      
      {/* Left eye line */}
      <Path
        path={(() => {
          const p = Skia.Path.Make();
          p.moveTo(8, 25.0004);
          p.quadTo(13.5, 24.4995, 15.5, 24.5);
          p.quadTo(21, 25.0004, 21, 25.0004);
          return p;
        })()}
        color={color}
        style="stroke"
        strokeWidth={3}
        strokeCap="round"
      />
      
      {/* Right eye line */}
      <Path
        path={(() => {
          const p = Skia.Path.Make();
          p.moveTo(48, 25.0004);
          p.quadTo(53.5, 24.4995, 55.5, 24.5);
          p.quadTo(61, 25.0004, 61, 25.0004);
          return p;
        })()}
        color={color}
        style="stroke"
        strokeWidth={3}
        strokeCap="round"
      />
      
      {/* Forehead dot */}
      <Circle cx={34.5} cy={2.5} r={2.5} color={color} style="fill" />
      
      {/* Chin dot (only when speaking) */}
      {isSpeaking && (
        <Path
          path={(() => {
            const p = Skia.Path.Make();
            p.moveTo(33.0082, 74.23);
            p.quadTo(31.8082, 74.2269, 30.5039, 75.8902);
            p.quadTo(30.0018, 76.7222, 31.4992, 77.7256);
            p.quadTo(40.5004, 77.2498, 40.5017, 76.7493);
            p.quadTo(40.503, 76.2489, 38.5069, 74.7442);
            p.quadTo(38.0082, 74.2429, 37.5095, 73.7416);
            p.quadTo(34.5082, 74.2338, 33.0082, 74.23);
            p.close();
            return p;
          })()}
          color={color}
          style="fill"
        />
      )}
    </Group>
  );
}

/**
 * Helper: Transform a 2D point on a sphere surface to screen coordinates
 * Takes a point in "face space" (normalized -1 to 1) and projects it onto
 * a rotating sphere, returning screen coordinates and visibility
 */
function transformFacePoint(faceX, faceY, rotationX, rotationY, centerX, centerY, radius) {
  // Convert face coordinates to spherical position on the front of the sphere
  // faceX/faceY are in range -1 to 1, representing position on the face
  // We map these to a hemisphere (the front of the sphere)
  
  // Limit how far to the edges we go (keeps face features visible longer)
  const maxAngle = Math.PI * 0.4; // 40% of hemisphere
  const theta = faceX * maxAngle; // Longitude angle from center
  const phi = Math.PI / 2 + faceY * maxAngle; // Latitude angle (0.5 = equator)
  
  // Convert spherical to 3D cartesian (on unit sphere)
  let sphereX = Math.sin(phi) * Math.sin(theta);
  let sphereY = -Math.cos(phi);
  let sphereZ = Math.sin(phi) * Math.cos(theta);
  
  // Apply Y rotation (horizontal spin)
  const cosY = Math.cos(rotationY);
  const sinY = Math.sin(rotationY);
  const rotatedX = sphereX * cosY - sphereZ * sinY;
  const rotatedZ1 = sphereX * sinY + sphereZ * cosY;
  
  // Apply X rotation (vertical tilt)
  const cosX = Math.cos(rotationX);
  const sinX = Math.sin(rotationX);
  const rotatedY = sphereY * cosX - rotatedZ1 * sinX;
  const rotatedZ = sphereY * sinX + rotatedZ1 * cosX;
  
  // Project to screen coordinates
  const screenX = centerX + rotatedX * radius;
  const screenY = centerY + rotatedY * radius;
  
  // Visibility: front-facing if Z > 0
  const isVisible = rotatedZ > -0.1;
  const opacity = Math.max(0, Math.min(1, rotatedZ + 0.3)); // Fade as it turns away
  
  return { x: screenX, y: screenY, z: rotatedZ, isVisible, opacity };
}

/**
 * RotatingFace3D - Renders the ZogChan face wrapped around a 3D rotating sphere
 * Face features are projected onto the sphere surface and rotate with it
 * Mouth animates smoothly when voice audio is playing
 */
function RotatingFace3D({ x, y, color, radius, rotationX = 0, rotationY = 0, rotationZ = 0, isVoicePlaying = false }) {
  const sphereConfig = config.physics.mascot.sphere3D || {};
  const faceOpacity = sphereConfig.faceOpacity || 0.9;
  const strokeWidth = sphereConfig.faceStrokeWidth || 2.5;
  
  // Scale face to fit inside sphere
  const faceRadius = radius * 0.75;
  
  // Helper to apply Z rotation (roll) around face center
  const applyZRotation = (px, py, centerX, centerY, angleZ) => {
    const cosZ = Math.cos(angleZ);
    const sinZ = Math.sin(angleZ);
    const dx = px - centerX;
    const dy = py - centerY;
    return {
      x: centerX + dx * cosZ - dy * sinZ,
      y: centerY + dx * sinZ + dy * cosZ,
    };
  };

  // Helper to create a transformed path from face-space points
  const createTransformedPath = (points, close = false) => {
    const path = Skia.Path.Make();
    let started = false;
    let minOpacity = 1;
    
    for (let i = 0; i < points.length; i++) {
      const transformed = transformFacePoint(
        points[i].x, points[i].y,
        rotationX, rotationY,
        x, y, faceRadius
      );
      
      if (transformed.isVisible) {
        // Apply Z rotation (roll) around face center
        const rolled = applyZRotation(transformed.x, transformed.y, x, y, rotationZ);
        
        if (!started) {
          path.moveTo(rolled.x, rolled.y);
          started = true;
        } else {
          path.lineTo(rolled.x, rolled.y);
        }
        minOpacity = Math.min(minOpacity, transformed.opacity);
      }
    }
    
    if (close && started) {
      path.close();
    }
    
    return { path, opacity: minOpacity, visible: started };
  };
  
  // Check if face center is visible
  const faceCenter = transformFacePoint(0, 0, rotationX, rotationY, x, y, faceRadius);
  if (!faceCenter.isVisible || faceCenter.opacity < 0.1) {
    return null; // Face is on back of sphere
  }
  
  // Define face features in normalized coordinates (-1 to 1)
  // Left eye: horizontal line
  const leftEye = [
    { x: -0.45, y: -0.15 },
    { x: -0.15, y: -0.15 },
  ];
  
  // Right eye: horizontal line
  const rightEye = [
    { x: 0.15, y: -0.15 },
    { x: 0.45, y: -0.15 },
  ];
  
  // Left eyebrow: curved arc above eye
  const leftEyebrow = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    leftEyebrow.push({
      x: -0.5 + t * 0.4,
      y: -0.45 + Math.sin(t * Math.PI) * 0.15,
    });
  }
  
  // Right eyebrow: curved arc above eye
  const rightEyebrow = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    rightEyebrow.push({
      x: 0.1 + t * 0.4,
      y: -0.45 + Math.sin(t * Math.PI) * 0.15,
    });
  }
  
  // Nose: small curved line
  const nose = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    nose.push({
      x: -0.1 + t * 0.2,
      y: 0.1 + Math.sin(t * Math.PI) * 0.08,
    });
  }
  
  // Mouth: rounded rectangle that opens (taller) and closes (flatter) like a real mouth
  // When voice is playing, mouth opens and closes smoothly
  // When voice stops, eases back to closed
  const mouthConfig = sphereConfig.mouth || {};
  const mouthClosedHeight = mouthConfig.closedHeight || 0.04;
  const mouthOpenHeight = mouthConfig.openHeight || 0.16;
  const mouthWidth = mouthConfig.width || 0.28;
  const mouthOscillationHz = mouthConfig.oscillationHz || 3;
  const mouthCenterY = mouthConfig.centerY || 0.38;
  const mouthCornerRadius = mouthConfig.cornerRadius || 0.03;
  
  let mouthOpenAmount = 0;
  const time = Date.now() / 1000;
  const easeBackDuration = 0.15; // How long to ease back to closed (seconds)
  
  if (isVoicePlaying) {
    // Oscillate mouth open/close at configured Hz for speech rhythm
    mouthOpenAmount = (Math.sin(time * mouthOscillationHz * Math.PI * 2) + 1) / 2; // 0 to 1
    // Track state for smooth close
    mouthAnimationState.wasPlaying = true;
    mouthAnimationState.lastOpenAmount = mouthOpenAmount;
    mouthAnimationState.stopTime = 0;
  } else if (mouthAnimationState.wasPlaying) {
    // Voice just stopped - ease back to closed smoothly
    if (mouthAnimationState.stopTime === 0) {
      mouthAnimationState.stopTime = time;
    }
    
    const timeSinceStop = time - mouthAnimationState.stopTime;
    const easeProgress = Math.min(1, timeSinceStop / easeBackDuration);
    
    // Ease out: starts fast, slows down as it closes
    const easeOut = 1 - Math.pow(1 - easeProgress, 2);
    mouthOpenAmount = mouthAnimationState.lastOpenAmount * (1 - easeOut);
    
    if (easeProgress >= 1) {
      // Finished easing, reset state
      mouthAnimationState.wasPlaying = false;
      mouthOpenAmount = 0;
    }
  }
  
  // Mouth is a rounded rectangle: wide, short when closed, taller when open
  // Real mouth physics: upper lip stays mostly fixed, lower jaw drops down
  // So expansion is ~85% downward, ~15% upward
  const mouthHeight = mouthClosedHeight + (mouthOpenHeight - mouthClosedHeight) * mouthOpenAmount;
  const halfWidth = mouthWidth / 2;
  const expansionAmount = mouthHeight - mouthClosedHeight;
  const upwardExpansion = expansionAmount * 0.15;   // 15% goes up
  const downwardExpansion = expansionAmount * 0.85; // 85% goes down
  
  // Top edge stays mostly fixed, bottom edge drops
  const topY = mouthCenterY - (mouthClosedHeight / 2) - upwardExpansion;
  const bottomY = mouthCenterY + (mouthClosedHeight / 2) + downwardExpansion;
  const actualHeight = bottomY - topY;
  const cornerR = Math.min(mouthCornerRadius, actualHeight / 2); // Corner radius can't exceed half height
  
  // Generate rounded rectangle points
  const mouth = [];
  const cornerSegments = 4; // Segments per corner for smooth rounding
  
  // Top-left corner
  for (let i = 0; i <= cornerSegments; i++) {
    const angle = Math.PI + (i / cornerSegments) * (Math.PI / 2);
    mouth.push({
      x: -halfWidth + cornerR + Math.cos(angle) * cornerR,
      y: topY + cornerR + Math.sin(angle) * cornerR,
    });
  }
  // Top-right corner
  for (let i = 0; i <= cornerSegments; i++) {
    const angle = -Math.PI / 2 + (i / cornerSegments) * (Math.PI / 2);
    mouth.push({
      x: halfWidth - cornerR + Math.cos(angle) * cornerR,
      y: topY + cornerR + Math.sin(angle) * cornerR,
    });
  }
  // Bottom-right corner
  for (let i = 0; i <= cornerSegments; i++) {
    const angle = 0 + (i / cornerSegments) * (Math.PI / 2);
    mouth.push({
      x: halfWidth - cornerR + Math.cos(angle) * cornerR,
      y: bottomY - cornerR + Math.sin(angle) * cornerR,
    });
  }
  // Bottom-left corner
  for (let i = 0; i <= cornerSegments; i++) {
    const angle = Math.PI / 2 + (i / cornerSegments) * (Math.PI / 2);
    mouth.push({
      x: -halfWidth + cornerR + Math.cos(angle) * cornerR,
      y: bottomY - cornerR + Math.sin(angle) * cornerR,
    });
  }
  
  // Forehead dot (with Z rotation applied)
  const foreheadDotRaw = transformFacePoint(0, -0.7, rotationX, rotationY, x, y, faceRadius);
  const foreheadDotRolled = applyZRotation(foreheadDotRaw.x, foreheadDotRaw.y, x, y, rotationZ);
  const foreheadDot = { ...foreheadDotRaw, x: foreheadDotRolled.x, y: foreheadDotRolled.y };
  
  // Create transformed paths
  const leftEyePath = createTransformedPath(leftEye);
  const rightEyePath = createTransformedPath(rightEye);
  const leftEyebrowPath = createTransformedPath(leftEyebrow);
  const rightEyebrowPath = createTransformedPath(rightEyebrow);
  const nosePath = createTransformedPath(nose);
  const mouthPath = createTransformedPath(mouth, true); // Close path for filled oval
  
  return (
    <Group>
      {/* Left eyebrow */}
      {leftEyebrowPath.visible && (
        <Path
          path={leftEyebrowPath.path}
          color={color}
          opacity={faceOpacity * leftEyebrowPath.opacity}
          style="stroke"
          strokeWidth={strokeWidth}
          strokeCap="round"
        />
      )}
      
      {/* Right eyebrow */}
      {rightEyebrowPath.visible && (
        <Path
          path={rightEyebrowPath.path}
          color={color}
          opacity={faceOpacity * rightEyebrowPath.opacity}
          style="stroke"
          strokeWidth={strokeWidth}
          strokeCap="round"
        />
      )}
      
      {/* Left eye */}
      {leftEyePath.visible && (
        <Path
          path={leftEyePath.path}
          color={color}
          opacity={faceOpacity * leftEyePath.opacity}
          style="stroke"
          strokeWidth={strokeWidth * (sphereConfig.eyeThickness || 2.5)}
          strokeCap="round"
        />
      )}
      
      {/* Right eye */}
      {rightEyePath.visible && (
        <Path
          path={rightEyePath.path}
          color={color}
          opacity={faceOpacity * rightEyePath.opacity}
          style="stroke"
          strokeWidth={strokeWidth * (sphereConfig.eyeThickness || 2.5)}
          strokeCap="round"
        />
      )}
      
      {/* Nose - removed for cleaner look */}
      
      {/* Mouth - filled oval that opens/closes */}
      {mouthPath.visible && (
        <Path
          path={mouthPath.path}
          color={color}
          opacity={faceOpacity * mouthPath.opacity}
          style="fill"
        />
      )}
      
      {/* Forehead dot */}
      {foreheadDot.isVisible && (
        <Circle
          cx={foreheadDot.x}
          cy={foreheadDot.y}
          r={strokeWidth * 1.5}
          color={color}
          opacity={faceOpacity * foreheadDot.opacity}
          style="fill"
        />
      )}
    </Group>
  );
}

/**
 * GameRenderer - Unified Skia renderer for all platforms
 * This same code works on Web, iOS, and Android
 * Touch events pass through the Canvas to allow line drawing
 * 
 * Uses shared gameState object for direct mutation without React reconciliation overhead.
 * Frame prop triggers re-render when game state updates (minimal React reconciliation).
 */
// Track mouth animation state for smooth close
const mouthAnimationState = { wasPlaying: false, stopTime: 0, lastOpenAmount: 0 };

const GameRendererComponent = ({ width, height, gameState, frame, lines = [], currentPath = null, debugMode = false }) => {
  // Extract values from shared state object (read directly, no React reconciliation)
  const { mascotPos, obstacles = [], bounceImpact, gelatoCreationTime, currentWord, mascotVelocityY = 0, mascotVelocityX = 0, mascotRadius = 45, parallaxStars = [], trails = [], primaryColor = '#FFFFFF', particles = [], wallGlows = [], bounceRipples = [], lastBounceScale = null, deathFadeProgress = 0, deathStartTime = null, coinCountCutsceneActive = false, coinCountCutsceneStartTime = null, coins = [], coinCount = 0, sphereRotation = { rotationX: 0, rotationY: 0, rotationZ: 0 }, isVoicePlaying = false } = gameState;
  const mascotX = mascotPos.x;
  const mascotY = mascotPos.y;

  // Calculate death fade opacity (0.0 = fully visible, 1.0 = fully faded)
  const deathFadeOpacity = 1.0 - deathFadeProgress;
  
  // Frame is used to trigger re-render but not read directly
  // eslint-disable-next-line no-unused-vars
  const _frame = frame;
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
  }

  return (
    <View style={{ width, height, position: 'relative' }} pointerEvents="box-none">
      <Canvas style={{ width, height }} pointerEvents="none">
        {/* Background */}
        <Fill color={config.visuals.backgroundColor} />

        {/* Game content with death fade */}
        <Group opacity={deathFadeOpacity}>
          {/* Parallax starfield background */}
          {parallaxStars.map((star, index) => {
          // Calculate twinkle effect (subtle opacity pulsing)
          let twinkledOpacity = star.opacity;
          if (config.parallax.twinkle.enabled) {
            const time = Date.now() / 1000; // Current time in seconds
            const { speed, intensity } = config.parallax.twinkle;
            
            // Each star twinkles at its own rate with unique phase offset
            const twinklePhase = star.twinklePhase || 0;
            const twinkleSpeedMultiplier = star.twinkleSpeed || 1.0;
            const sineWave = Math.sin(time * speed * twinkleSpeedMultiplier + twinklePhase);
            
            // Apply opacity variation: baseOpacity * (1 + intensity * sineWave)
            // sineWave ranges from -1 to 1, so this gives opacity variation of ±intensity
            twinkledOpacity = star.opacity * (1 + intensity * sineWave);
            
            // Clamp to valid opacity range (0 to 1)
            twinkledOpacity = Math.max(0, Math.min(1, twinkledOpacity));
          }
          
          return (
            <StarShape
              key={`star-${index}`}
              cx={star.x}
              cy={star.y}
              size={star.size}
              color={primaryColor}
              opacity={twinkledOpacity}
            />
          );
        })}

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
        // Render curved path if enabled and path exists
        if (config.gelato.renderMode === 'curved' && line.originalPath && line.originalPath.length > 1) {
          // Base blend: Interpolate each point toward straight line using curveBlend
          const blendAmount = config.gelato.curveBlend; // 0.0 to 1.0
          const blendedPoints = line.originalPath.map((point, i) => {
            const t = i / (line.originalPath.length - 1);
            const straightX = line.startX + (line.endX - line.startX) * t;
            const straightY = line.startY + (line.endY - line.startY) * t;
            // blendAmount = 0.0 → use straight line (straightX)
            // blendAmount = 1.0 → use original drawing (point.x)
            // blendAmount = 0.5 → 50/50 mix
            const blendedX = point.x * blendAmount + straightX * (1 - blendAmount);
            const blendedY = point.y * blendAmount + straightY * (1 - blendAmount);
            return { x: blendedX, y: blendedY };
          });

          // Calculate perpendicular direction for deformations
          const dx = line.endX - line.startX;
          const dy = line.endY - line.startY;
          const lineLength = Math.sqrt(dx * dx + dy * dy);
          const perpX = -dy / lineLength;
          const perpY = dx / lineLength;

          // Apply creation pop-in oscillation
          let creationBendAmount = 0;
          if (gelatoCreationTime) {
            const timeSinceCreation = Date.now() - gelatoCreationTime;
            const creationConfig = config.gelato.creation;

            if (timeSinceCreation < creationConfig.duration) {
              const progress = timeSinceCreation / creationConfig.duration;
              const frequency = creationConfig.frequency * Math.PI * 2;
              const dampingFactor = Math.exp(-creationConfig.damping * progress * 5);
              const oscillation = Math.sin(frequency * progress) * dampingFactor;
              creationBendAmount = creationConfig.maxBendAmount * oscillation;
            }
          }

          // Apply bounce deformation oscillation
          let bounceBendAmount = 0;
          if (bounceImpact && bounceImpact.timestamp) {
            const timeSinceBounce = Date.now() - bounceImpact.timestamp;
            const deformConfig = config.gelato.deformation;

            if (timeSinceBounce < deformConfig.duration) {
              const progress = timeSinceBounce / deformConfig.duration;
              const frequency = deformConfig.frequency * Math.PI * 2;
              const dampingFactor = Math.exp(-deformConfig.damping * progress * 5);
              const oscillation = Math.sin(frequency * progress) * dampingFactor;
              const impactStrength = Math.min(bounceImpact.strength / 10, 1);
              bounceBendAmount = deformConfig.maxBendAmount * oscillation * impactStrength;
            }
          }

          // Apply total deformation to blended points
          const totalBend = creationBendAmount + bounceBendAmount;
          const deformedPoints = blendedPoints.map((point, i) => {
            // Apply bend perpendicular to straight line
            // Stronger bend in the middle, weaker at endpoints
            const t = i / (blendedPoints.length - 1);
            const bendStrength = Math.sin(t * Math.PI); // 0 at ends, 1 in middle
            
            return {
              x: point.x + perpX * totalBend * bendStrength,
              y: point.y + perpY * totalBend * bendStrength,
            };
          });

          // Render path as simple connected lines (no smoothing)
          const path = Skia.Path.Make();
          path.moveTo(deformedPoints[0].x, deformedPoints[0].y);
          
          for (let i = 1; i < deformedPoints.length; i++) {
            path.lineTo(deformedPoints[i].x, deformedPoints[i].y);
          }

          // Calculate fade-out opacity after bounce
          let opacity = 1;
          if (bounceImpact && bounceImpact.timestamp) {
            const timeSinceBounce = Date.now() - bounceImpact.timestamp;
            const fadeOutDuration = config.gelato.fadeOutDuration;
            const fadeProgress = Math.min(timeSinceBounce / fadeOutDuration, 1);
            opacity = 1 - fadeProgress;
          }

          return (
            <Path
              key={index}
              path={path}
              color={primaryColor}
              opacity={opacity}
              style="stroke"
              strokeWidth={config.gelato.thickness}
              strokeCap="round"
            />
          );
        }

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
                color={primaryColor}
                opacity={opacity}
                style="stroke"
                strokeWidth={config.gelato.thickness}
                strokeCap="round"
              />
            );
          }

          // Still fading but no longer deforming - draw straight line with fade
          return (
            <Line
              key={index}
              p1={vec(line.startX, line.startY)}
              p2={vec(line.endX, line.endY)}
              color={primaryColor}
              opacity={opacity}
              style="stroke"
              strokeWidth={config.gelato.thickness}
              strokeCap="round"
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
                color={primaryColor}
                style="stroke"
                strokeWidth={config.gelato.thickness}
                strokeCap="round"
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
            color={primaryColor}
            style="stroke"
            strokeWidth={config.gelato.thickness}
            strokeCap="round"
          />
        );
      })}

      {/* Debug visualization: Show actual physics hitbox for gelato forgiveness */}
      {debugMode && gameState.gelato && (() => {
        const gelato = gameState.gelato;
        // Draw semi-transparent red rectangle showing actual physics hitbox
        return (
          <Rect
            x={gelato.x - gelato.width / 2}
            y={gelato.y - gelato.height / 2}
            width={gelato.width}
            height={gelato.height}
            color="#FF000040"
            style="stroke"
            strokeWidth={2}
            transform={[{ rotate: gelato.angle }]}
            origin={vec(gelato.x, gelato.y)}
          />
        );
      })()}

      {/* Motion trails behind ball - supports multiple overlapping trails */}
      {trails.map((trailData, trailIdx) => {
        const trail = trailData.points;
        const endFadeProgress = trailData.endFadeProgress;

        if (trail.length < 2) return null;

        const ballRadius = mascotRadius;
        const maxOpacity = config.physics.mascot.trail.maxOpacity;
        const layers = config.physics.mascot.trail.gradientLayers;

        // Apply end fade (when trail expires after bounce window)
        const endFadeMultiplier = 1.0 - endFadeProgress; // 1.0 = visible, 0.0 = faded

        // Render multiple overlapping paths with decreasing lengths for gradient effect
        return Array.from({ length: layers }).map((_, layerIndex) => {
          // Calculate what portion of trail to include in this layer
          const startIndex = Math.floor((trail.length - 1) * (layerIndex / layers));
          const layerTrail = trail.slice(startIndex);

          if (layerTrail.length < 2) return null;

          // Create smooth path for this layer
          const path = Skia.Path.Make();
          path.moveTo(layerTrail[0].x, layerTrail[0].y);

          for (let i = 1; i < layerTrail.length - 1; i++) {
            const midX = (layerTrail[i].x + layerTrail[i + 1].x) / 2;
            const midY = (layerTrail[i].y + layerTrail[i + 1].y) / 2;
            path.quadTo(layerTrail[i].x, layerTrail[i].y, midX, midY);
          }

          if (layerTrail.length > 1) {
            path.lineTo(
              layerTrail[layerTrail.length - 1].x,
              layerTrail[layerTrail.length - 1].y
            );
          }

          // Opacity decreases for shorter layers (creates fade at head)
          const layerOpacity = (layerIndex + 1) / layers;

          // Calculate gradient start/end points along the trail
          const startPoint = layerTrail[0];
          const fadeLength = Math.min(layerTrail.length, 8);
          const endPoint = layerTrail[Math.min(fadeLength, layerTrail.length - 1)];

          return (
            <Path
              key={`trail-${trailIdx}-layer-${layerIndex}`}
              path={path}
              opacity={layerOpacity * maxOpacity * endFadeMultiplier}
              style="stroke"
              strokeWidth={ballRadius * 2}
              strokeCap="round"
              strokeJoin="round"
            >
              <LinearGradient
                start={vec(startPoint.x, startPoint.y)}
                end={vec(endPoint.x, endPoint.y)}
                colors={[`${primaryColor}00`, primaryColor]}
                positions={[0, 1]}
              />
            </Path>
          );
        }).filter(Boolean);
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
            color={primaryColor}
            opacity={0.6}
            style="stroke"
            strokeWidth={config.gelato.previewThickness || config.gelato.thickness}
            strokeCap="round"
          >
            <DashPathEffect intervals={[1, 15]} />
          </Path>
        );
      })()}

      {/* Wall bounce particles (dust clouds) */}
      {particles.map((particle, index) => (
        <Circle
          key={`particle-${index}`}
          cx={particle.x}
          cy={particle.y}
          r={particle.size}
          color={primaryColor}
          opacity={particle.opacity}
        />
      ))}

      {/* Ground glow (emanates from below screen edge) */}
      {config.physics.mascot.glow.enabled && (() => {
        const glowY = height * config.physics.mascot.glow.yPosition;
        const glowRadiusX = mascotRadius * config.physics.mascot.glow.scaleX;
        const glowRadiusY = mascotRadius * config.physics.mascot.glow.scaleY;

        // Pulsating animation using sine wave
        const time = Date.now() / 1000; // Convert to seconds
        const pulsePhase = (Math.sin(time * Math.PI * 2 / config.physics.mascot.glow.pulseSpeed) + 1) / 2; // 0 to 1
        const pulseAmount = config.physics.mascot.glow.pulseAmount;
        const baseOpacity = config.physics.mascot.glow.opacity;
        const pulsatingOpacity = baseOpacity * (1 - pulseAmount + pulsePhase * pulseAmount);

        // Height-based opacity modulation (0 = top of screen, height = bottom)
        const ballHeightPercent = mascotY / height; // 0 = top, 1 = bottom
        const fadeStart = config.physics.mascot.glow.heightFadeStart;
        const fadeEnd = config.physics.mascot.glow.heightFadeEnd;

        // Calculate height fade: 0 at top, 1 at fadeEnd
        const heightFade = Math.max(0, Math.min(1, (ballHeightPercent - fadeStart) / (fadeEnd - fadeStart)));

        // Apply pulsation and height-based fade
        const finalOpacity = pulsatingOpacity * heightFade;

        return (
          <Oval
            x={mascotX - glowRadiusX}
            y={glowY - glowRadiusY}
            width={glowRadiusX * 2}
            height={glowRadiusY * 2}
            color={primaryColor}
            opacity={finalOpacity}
          >
            <Blur blur={config.physics.mascot.glow.blur} />
          </Oval>
        );
      })()}

      {/* Wall glow effects (impact feedback on side walls) */}
      {config.walls.glow.enabled && wallGlows.map((glow, index) => {
        const glowConfig = config.walls.glow;
        const currentTime = Date.now();
        const age = currentTime - glow.timestamp;

        // Calculate opacity: fade from peak to 0 linearly
        const fadeProgress = age / glowConfig.fadeOutMs;
        const glowOpacity = Math.max(0, (1 - fadeProgress) * glowConfig.opacity);

        // Determine X position based on which wall
        const wallThickness = config.walls.thickness;
        const glowX = glow.side === 'left'
          ? wallThickness + glowConfig.xOffset
          : width - wallThickness - glowConfig.xOffset;

        // Vertical dimensions (rotated 90° from ground glow)
        const glowWidth = mascotRadius * glowConfig.scaleX;   // Horizontal (narrow)
        const glowHeight = mascotRadius * glowConfig.scaleY;  // Vertical (tall)

        return (
          <Oval
            key={`wall-glow-${index}`}
            x={glowX - glowWidth}
            y={glow.y - glowHeight}
            width={glowWidth * 2}
            height={glowHeight * 2}
            color={primaryColor}
            opacity={glowOpacity}
          >
            <Blur blur={glowConfig.blur} />
          </Oval>
        );
      })}

      {/* Bounce ripple effects */}
      {config.physics.mascot.bounceJuice.ripple.enabled && bounceRipples.map((ripple, index) => {
        const rippleConfig = config.physics.mascot.bounceJuice.ripple;
        const currentTime = Date.now();
        const age = currentTime - ripple.timestamp;
        const progress = Math.min(age / rippleConfig.duration, 1);

        // Ease out: starts fast, slows down as it expands
        const easeOut = 1 - Math.pow(1 - progress, 3);

        // Expand from mascot radius to maxRadius with ease-out
        const currentRadius = mascotRadius + (rippleConfig.maxRadius - mascotRadius) * easeOut;

        // Fade out with same ease-out curve for smooth visual consistency
        const rippleOpacity = rippleConfig.opacity * (1 - easeOut);

        return (
          <Circle
            key={`ripple-${index}`}
            cx={mascotX}
            cy={mascotY}
            r={currentRadius}
            color={primaryColor}
            opacity={rippleOpacity}
            style="stroke"
            strokeWidth={rippleConfig.strokeWidth}
          />
        );
      })}

      {/* Mascot circle with scale animation */}
      <Group>
        {(() => {
          // Calculate scale animation
          let scale = 1.0;
          if (config.physics.mascot.bounceJuice.scale.enabled && lastBounceScale) {
            const scaleConfig = config.physics.mascot.bounceJuice.scale;
            const currentTime = Date.now();
            const age = currentTime - lastBounceScale.timestamp;

            if (age < scaleConfig.duration) {
              const progress = age / scaleConfig.duration;
              // Ease out: quick scale up, then ease back to normal
              const easeOut = 1 - Math.pow(progress, 3);
              scale = 1.0 + (scaleConfig.amount - 1.0) * easeOut;
            }
          }

          return (
            <>
              <Circle
                cx={mascotX}
                cy={mascotY}
                r={mascotRadius * scale}
                color={primaryColor}
                style="stroke"
                strokeWidth={config.gelato.thickness}
              />

              {/* 3D Rotating Face (when sphere3D enabled) */}
              {config.physics.mascot.sphere3D?.enabled && (
                <RotatingFace3D
                  x={mascotX}
                  y={mascotY}
                  color={primaryColor}
                  radius={mascotRadius * scale}
                  rotationX={sphereRotation.rotationX}
                  rotationY={sphereRotation.rotationY}
                  rotationZ={sphereRotation.rotationZ}
                  isVoicePlaying={isVoicePlaying}
                />
              )}

              {/* ZogChan Face (legacy, when enabled and sphere3D disabled) */}
              {config.physics.mascot.face.enabled && !config.physics.mascot.sphere3D?.enabled && (
                <ZogChanFace
                  x={mascotX}
                  y={mascotY}
                  color={primaryColor}
                  isSpeaking={currentWord !== null}
                  radius={mascotRadius * scale}
                />
              )}

              {/* Coin animations */}
              {config.coins.enabled && coins.map((coin, index) => {
                const coinColor = config.coins.useDynamicColor ? primaryColor : config.coins.staticColor;

                // Apply horizontal scale transform for rotation effect
                const transform = [
                  { translateX: coin.x },
                  { translateY: coin.y },
                  { scaleX: coin.scaleX },
                  { translateX: -coin.x },
                  { translateY: -coin.y },
                ];

                return (
                  <Group key={`coin-${index}`} transform={transform}>
                    <RoundedRect
                      x={coin.x - config.coins.width / 2}
                      y={coin.y - config.coins.height / 2}
                      width={config.coins.width}
                      height={config.coins.height}
                      r={config.coins.cornerRadius}
                      color={coinColor}
                      opacity={coin.opacity}
                    />
                  </Group>
                );
              })}
            </>
          );
        })()}
      </Group>
      </Group>

      </Canvas>

      {/* Coin count display on death screen (cutscene) - DISABLED: now shown in progress bar */}
      {false && config.coins.enabled && config.coins.deathScreen.show && coinCountCutsceneActive && coinCountCutsceneStartTime !== null && (() => {
        const countColor = config.coins.deathScreen.useDynamicColor ? primaryColor : config.coins.deathScreen.staticColor;
        const fadeInMs = config.coins.deathScreen.fadeInMs;
        
        // Calculate coin count opacity based on time since cutscene started
        const currentTime = Date.now();
        const timeSinceCutsceneStart = currentTime - coinCountCutsceneStartTime;
        
        let coinCountOpacity = 0;
        if (timeSinceCutsceneStart < fadeInMs) {
          // Fade in over first 300ms
          coinCountOpacity = timeSinceCutsceneStart / fadeInMs;
        } else {
          // Stay at full opacity for remaining cutscene duration
          coinCountOpacity = 1.0;
        }
        
        return (
          <View style={styles.coinCountContainer} pointerEvents="none">
            <Text style={[styles.coinCountText, {
              opacity: coinCountOpacity,
              color: countColor,
              fontSize: config.coins.deathScreen.fontSize,
              top: `${config.coins.deathScreen.yPosition * 100}%`,
            }]}>
              {coinCount}
            </Text>
            {/* TODO: Add radial progress bar animation here */}
          </View>
        );
      })()}

      {/* Word overlay with Mexican wave animation */}
      {currentWord && wordOpacity > 0 && (
        <View
          style={[
            styles.wordContainer,
            { transform: [{ translateY: wordVerticalOffset }] }
          ]}
          pointerEvents="none"
        >
          <WaveText
            text={currentWord.text}
            opacity={wordOpacity}
            color={primaryColor}
            screenWidth={width}
          />
        </View>
      )}
    </View>
  );
};

// Memoize to prevent unnecessary re-renders - only re-render when frame or other props change
export const GameRenderer = memo(GameRendererComponent);

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
    // fontSize is now set dynamically per letter
    // color is set inline with primaryColor (see WaveText component)
    letterSpacing: 1,
  },
  coinCountContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  coinCountText: {
    position: 'absolute',
    fontFamily: 'Inter',
    fontWeight: '300',
    textAlign: 'center',
    // fontSize, color, opacity, top are set inline from config
  },
});
