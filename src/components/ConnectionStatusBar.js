import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ConnectionStatusBar = ({ isConnected, isOnline }) => {
  if (isConnected) return null;

  const label = !isOnline ? 'No internet connection' : 'Connecting to peer…';
  const color = !isOnline ? '#FF3B30' : '#FF9500';

  return (
    <View style={[styles.bar, { backgroundColor: color }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default ConnectionStatusBar;
