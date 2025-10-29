import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import { GameRenderer } from '../game/render/GameRenderer';
import { GameCore } from '../game/core/GameCore';
import { config } from '../config';
import { playSound } from '../utils/audio';

/**
 * PreviewMode - Game preview with draft message and overlay controls
 */
export function PreviewMode({ message, isActive, onSave }) {
  const [dimensions] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  });

  const gameCore = useRef(null);
  const [, forceUpdate] = useState(0);

  // Game state refs
  const mascotPos = useRef({ x: dimensions.width / 2, y: 100 });
  const obstacles = useRef([]);
  const bounceImpact = useRef(null);
  const gelatoCreationTime = useRef(null);
  const currentWord = useRef(null);
  const mascotVelocityY = useRef(0);
  const [lines, setLines] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);
  const lastGelatoData = useRef(null);

  // Initialize preview game instance
  useEffect(() => {
    // Create GameCore with custom preview message
    gameCore.current = new GameCore(dimensions.width, dimensions.height, message);

    let animationFrameId;
    let lastTime = performance.now();

    const animate = (currentTime) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      const cappedDelta = Math.min(deltaTime, 16.667);

      gameCore.current.step(cappedDelta);

      // Update game state
      mascotPos.current = gameCore.current.getMascotPosition();
      obstacles.current = gameCore.current.getObstacles();
      bounceImpact.current = gameCore.current.getBounceImpact();
      gelatoCreationTime.current = gameCore.current.getGelatoCreationTime();
      currentWord.current = gameCore.current.getCurrentWord();
      mascotVelocityY.current = gameCore.current.getMascotVelocityY();

      // Sync lines
      const currentGelatoData = gameCore.current.getGelatoLineData();
      if (currentGelatoData !== lastGelatoData.current) {
        lastGelatoData.current = currentGelatoData;
        setLines(currentGelatoData ? [currentGelatoData] : []);
      }

      forceUpdate(n => n + 1);
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (gameCore.current) {
        gameCore.current.destroy();
      }
    };
  }, [message, dimensions.width, dimensions.height]);

  // Helper: Calculate total path length
  const calculatePathLength = (points) => {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  };

  // Helper: Trim path from start to maintain max length
  const trimPathToMaxLength = (points, maxLength) => {
    let totalLength = calculatePathLength(points);
    let trimmedPoints = [...points];

    while (totalLength > maxLength && trimmedPoints.length > 2) {
      // Remove first point
      const dx = trimmedPoints[1].x - trimmedPoints[0].x;
      const dy = trimmedPoints[1].y - trimmedPoints[0].y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);

      trimmedPoints.shift();
      totalLength -= segmentLength;
    }

    return trimmedPoints;
  };

  // Touch handlers for drawing
  const handleTouchStart = (event) => {
    const touch = event.nativeEvent.touches?.[0] || event.nativeEvent;
    setCurrentPath([{ x: touch.pageX, y: touch.pageY }]);
  };

  const handleTouchMove = (event) => {
    if (!currentPath) return;
    const touch = event.nativeEvent.touches?.[0] || event.nativeEvent;

    // Add current point to path
    const newPath = [...currentPath, { x: touch.pageX, y: touch.pageY }];

    // Trim path if it exceeds max length (sliding start)
    const trimmedPath = trimPathToMaxLength(newPath, config.gelato.maxLength);

    setCurrentPath(trimmedPath);
  };

  const handleTouchEnd = () => {
    if (currentPath && currentPath.length >= 2 && gameCore.current) {
      const startPoint = currentPath[0];
      const endPoint = currentPath[currentPath.length - 1];

      const gelatoLine = gameCore.current.createGelato(
        startPoint.x,
        startPoint.y,
        endPoint.x,
        endPoint.y
      );

      if (gelatoLine) {
        setLines([gelatoLine]);
      }

      setCurrentPath(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Game renderer */}
      <View
        style={styles.gameView}
        onStartShouldSetResponder={() => true}
        onResponderGrant={handleTouchStart}
        onResponderMove={handleTouchMove}
        onResponderRelease={handleTouchEnd}
      >
        <GameRenderer
          width={dimensions.width}
          height={dimensions.height}
          mascotX={mascotPos.current.x}
          mascotY={mascotPos.current.y}
          obstacles={obstacles.current}
          lines={lines}
          currentPath={currentPath}
          bounceImpact={bounceImpact.current}
          gelatoCreationTime={gelatoCreationTime.current}
          currentWord={currentWord.current}
          mascotVelocityY={mascotVelocityY.current}
        />
      </View>

      {/* Overlay controls */}
      <View style={styles.overlay}>
        {/* Preview label (top-right) */}
        <Text style={styles.previewLabel}>PREVIEW</Text>

        {/* Save/Send Now button (bottom-center) */}
        <View style={styles.saveButtonContainer} pointerEvents="auto">
          <Pressable
            style={styles.saveButton}
            onPress={() => {
              playSound('click');
              onSave();
            }}
          >
            <Text style={styles.saveButtonText}>
              {isActive ? 'Send Now' : 'Save'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  gameView: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none', // Allow touches to pass through to game
  },
  saveButtonContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 50,
  },
  saveButton: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#0a0a0a',
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 999,
    minWidth: 200,
    maxWidth: 400,
    width: '100%',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0a0a0a',
  },
  previewLabel: {
    position: 'absolute',
    top: 30,
    right: 30,
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    letterSpacing: 2,
    padding: 30,
  },
});
