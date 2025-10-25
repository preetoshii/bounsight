import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * EditView - Message composition interface (stub for now)
 */
export function EditView({ date, message, isActive, onMessageChange, onBack, onPreview }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Edit View - Coming Soon</Text>
      <Text style={styles.text}>Date: {date}</Text>
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
