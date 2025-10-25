import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Confirmation - Send now confirmation dialog (stub for now)
 */
export function Confirmation({ onCancel, onConfirm }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Confirmation - Coming Soon</Text>
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
