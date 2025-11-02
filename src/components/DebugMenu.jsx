import React from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { config } from '../config';
import { triggerHaptic } from '../utils/haptics';

export function DebugMenu({ visible, onClose, hapticsConfig, setHapticsConfig, fpsCap, setFpsCap }) {
  if (!visible) return null;

  const fpsCapOptions = [null, 10, 20, 30, 40, 50, 60, 70, 80, 90, 120];

  const updateHapticConfig = (eventName, field, change) => {
    setHapticsConfig({
      ...hapticsConfig,
      [eventName]: {
        ...hapticsConfig[eventName],
        android: {
          ...hapticsConfig[eventName].android,
          [field]: Math.max(1, Math.min(field === 'amplitude' ? 255 : 1000, hapticsConfig[eventName].android[field] + change))
        }
      }
    });
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Debug Menu</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* FPS Cap Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>FPS Cap</Text>
            <View style={styles.fpsGrid}>
              {fpsCapOptions.map(option => (
                <Pressable
                  key={option || 'uncapped'}
                  onPress={() => setFpsCap(option)}
                  style={[
                    styles.fpsOption,
                    fpsCap === option && styles.fpsOptionActive
                  ]}
                >
                  <Text style={[
                    styles.fpsOptionText,
                    fpsCap === option && styles.fpsOptionTextActive
                  ]}>
                    {option || 'Off'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Haptics Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Haptics (Android)</Text>
            <Text style={styles.sectionSubtitle}>Duration: 1-1000ms | Amplitude: 1-255</Text>

            {/* Drawing Haptic */}
            <View style={styles.hapticItem}>
              <View style={styles.hapticHeader}>
                <Text style={styles.hapticLabel}>Drawing</Text>
                <Text style={styles.hapticValue}>
                  {hapticsConfig.drawing.android?.durationMs || 10}ms / {hapticsConfig.drawing.android?.amplitude || 20}
                </Text>
              </View>
              <View style={styles.hapticControls}>
                <View style={styles.controlRow}>
                  <Text style={styles.controlLabel}>Duration</Text>
                  <View style={styles.buttonRow}>
                    <Pressable onPress={() => updateHapticConfig('drawing', 'durationMs', -5)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>-5</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('drawing', 'durationMs', -1)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>-1</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('drawing', 'durationMs', 1)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>+1</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('drawing', 'durationMs', 5)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>+5</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.controlRow}>
                  <Text style={styles.controlLabel}>Amplitude</Text>
                  <View style={styles.buttonRow}>
                    <Pressable onPress={() => updateHapticConfig('drawing', 'amplitude', -10)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>-10</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('drawing', 'amplitude', -1)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>-1</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('drawing', 'amplitude', 1)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>+1</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('drawing', 'amplitude', 10)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>+10</Text>
                    </Pressable>
                  </View>
                </View>
                <Pressable
                  onPress={() => triggerHaptic('drawing', hapticsConfig)}
                  style={styles.testButton}
                >
                  <Text style={styles.testButtonText}>Test Haptic</Text>
                </Pressable>
              </View>
            </View>

            {/* Gelato Creation Haptic */}
            <View style={styles.hapticItem}>
              <View style={styles.hapticHeader}>
                <Text style={styles.hapticLabel}>Gelato Creation</Text>
                <Text style={styles.hapticValue}>
                  {hapticsConfig.gelatoCreation.android?.durationMs || 20}ms / {hapticsConfig.gelatoCreation.android?.amplitude || 50}
                </Text>
              </View>
              <View style={styles.hapticControls}>
                <View style={styles.controlRow}>
                  <Text style={styles.controlLabel}>Duration</Text>
                  <View style={styles.buttonRow}>
                    <Pressable onPress={() => updateHapticConfig('gelatoCreation', 'durationMs', -5)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>-5</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('gelatoCreation', 'durationMs', -1)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>-1</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('gelatoCreation', 'durationMs', 1)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>+1</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('gelatoCreation', 'durationMs', 5)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>+5</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.controlRow}>
                  <Text style={styles.controlLabel}>Amplitude</Text>
                  <View style={styles.buttonRow}>
                    <Pressable onPress={() => updateHapticConfig('gelatoCreation', 'amplitude', -10)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>-10</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('gelatoCreation', 'amplitude', -1)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>-1</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('gelatoCreation', 'amplitude', 1)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>+1</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('gelatoCreation', 'amplitude', 10)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>+10</Text>
                    </Pressable>
                  </View>
                </View>
                <Pressable
                  onPress={() => triggerHaptic('gelatoCreation', hapticsConfig)}
                  style={styles.testButton}
                >
                  <Text style={styles.testButtonText}>Test Haptic</Text>
                </Pressable>
              </View>
            </View>

            {/* Gelato Bounce Haptic */}
            <View style={styles.hapticItem}>
              <View style={styles.hapticHeader}>
                <Text style={styles.hapticLabel}>Gelato Bounce</Text>
                <Text style={styles.hapticValue}>
                  {hapticsConfig.gelatoBounce.android?.durationMs || 15}ms / {hapticsConfig.gelatoBounce.android?.amplitude || 30}
                </Text>
              </View>
              <View style={styles.hapticControls}>
                <View style={styles.controlRow}>
                  <Text style={styles.controlLabel}>Duration</Text>
                  <View style={styles.buttonRow}>
                    <Pressable onPress={() => updateHapticConfig('gelatoBounce', 'durationMs', -5)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>-5</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('gelatoBounce', 'durationMs', -1)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>-1</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('gelatoBounce', 'durationMs', 1)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>+1</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('gelatoBounce', 'durationMs', 5)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>+5</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.controlRow}>
                  <Text style={styles.controlLabel}>Amplitude</Text>
                  <View style={styles.buttonRow}>
                    <Pressable onPress={() => updateHapticConfig('gelatoBounce', 'amplitude', -10)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>-10</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('gelatoBounce', 'amplitude', -1)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>-1</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('gelatoBounce', 'amplitude', 1)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>+1</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('gelatoBounce', 'amplitude', 10)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>+10</Text>
                    </Pressable>
                  </View>
                </View>
                <Pressable
                  onPress={() => triggerHaptic('gelatoBounce', hapticsConfig)}
                  style={styles.testButton}
                >
                  <Text style={styles.testButtonText}>Test Haptic</Text>
                </Pressable>
              </View>
            </View>

            {/* Wall Bump Haptic */}
            <View style={styles.hapticItem}>
              <View style={styles.hapticHeader}>
                <Text style={styles.hapticLabel}>Wall Bump</Text>
                <Text style={styles.hapticValue}>
                  {hapticsConfig.wallBump.android?.durationMs || 20}ms / {hapticsConfig.wallBump.android?.amplitude || 40}
                </Text>
              </View>
              <View style={styles.hapticControls}>
                <View style={styles.controlRow}>
                  <Text style={styles.controlLabel}>Duration</Text>
                  <View style={styles.buttonRow}>
                    <Pressable onPress={() => updateHapticConfig('wallBump', 'durationMs', -5)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>-5</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('wallBump', 'durationMs', -1)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>-1</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('wallBump', 'durationMs', 1)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>+1</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('wallBump', 'durationMs', 5)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>+5</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.controlRow}>
                  <Text style={styles.controlLabel}>Amplitude</Text>
                  <View style={styles.buttonRow}>
                    <Pressable onPress={() => updateHapticConfig('wallBump', 'amplitude', -10)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>-10</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('wallBump', 'amplitude', -1)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>-1</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('wallBump', 'amplitude', 1)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>+1</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('wallBump', 'amplitude', 10)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>+10</Text>
                    </Pressable>
                  </View>
                </View>
                <Pressable
                  onPress={() => triggerHaptic('wallBump', hapticsConfig)}
                  style={styles.testButton}
                >
                  <Text style={styles.testButtonText}>Test Haptic</Text>
                </Pressable>
              </View>
            </View>

            {/* Loss Haptic */}
            <View style={styles.hapticItem}>
              <View style={styles.hapticHeader}>
                <Text style={styles.hapticLabel}>Loss</Text>
                <Text style={styles.hapticValue}>
                  {hapticsConfig.loss.android?.durationMs || 50}ms / {hapticsConfig.loss.android?.amplitude || 100}
                </Text>
              </View>
              <View style={styles.hapticControls}>
                <View style={styles.controlRow}>
                  <Text style={styles.controlLabel}>Duration</Text>
                  <View style={styles.buttonRow}>
                    <Pressable onPress={() => updateHapticConfig('loss', 'durationMs', -5)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>-5</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('loss', 'durationMs', -1)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>-1</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('loss', 'durationMs', 1)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>+1</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('loss', 'durationMs', 5)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>+5</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.controlRow}>
                  <Text style={styles.controlLabel}>Amplitude</Text>
                  <View style={styles.buttonRow}>
                    <Pressable onPress={() => updateHapticConfig('loss', 'amplitude', -10)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>-10</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('loss', 'amplitude', -1)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>-1</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('loss', 'amplitude', 1)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>+1</Text>
                    </Pressable>
                    <Pressable onPress={() => updateHapticConfig('loss', 'amplitude', 10)} style={styles.smallBtn}>
                      <Text style={styles.btnText}>+10</Text>
                    </Pressable>
                  </View>
                </View>
                <Pressable
                  onPress={() => triggerHaptic('loss', hapticsConfig)}
                  style={styles.testButton}
                >
                  <Text style={styles.testButtonText}>Test Haptic</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Close Button at Bottom */}
        <Pressable onPress={onClose} style={styles.bottomCloseButton}>
          <Text style={styles.bottomCloseButtonText}>Close & Apply</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 9999,
  },
  container: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
  },
  fpsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fpsOption: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#222',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#333',
  },
  fpsOptionActive: {
    backgroundColor: '#007AFF',
    borderColor: '#0056b3',
  },
  fpsOptionText: {
    fontSize: 16,
    color: '#888',
    fontWeight: '600',
  },
  fpsOptionTextActive: {
    color: '#fff',
  },
  hapticItem: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  hapticHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  hapticLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  hapticValue: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  hapticControls: {
    gap: 12,
  },
  controlRow: {
    gap: 8,
  },
  controlLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  smallBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#222',
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  btnText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  testButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  testButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  bottomCloseButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  bottomCloseButtonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
});
