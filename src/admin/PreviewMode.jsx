import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * PreviewMode - Game preview with overlay controls (stub for now)
 */
export function PreviewMode({ message, isActive, onBack, onSave }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Preview Mode - Coming Soon</Text>
      <Text style={styles.text}>Message: {message}</Text>
      <Text style={styles.text}>Active: {isActive ? 'Yes' : 'No'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#ffffff',
    fontSize: 16,
  },
});
