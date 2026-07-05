import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const STATUS_SYMBOLS = {
  pending:   '🕐',
  sent:      '✓',
  delivered: '✓✓',
  received:  '',
};

const MessageBubble = ({ message }) => {
  const isMe = message.from_peer === 0;

  return (
    <View style={[styles.row, isMe ? styles.rowRight : styles.rowLeft]}>
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubblePeer]}>
        {message.kind === 'image' ? (
          <Image source={{ uri: message.text }} style={styles.image} resizeMode="cover" />
        ) : (
          <Text style={[styles.text, isMe ? styles.textMe : styles.textPeer]}>
            {message.text}
          </Text>
        )}
        <View style={styles.meta}>
          <Text style={styles.time}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {isMe && (
            <Text style={styles.status}>
              {STATUS_SYMBOLS[message.status] || ''}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    marginVertical: 4,
    marginHorizontal: 8,
    flexDirection: 'row',
  },
  rowRight: { justifyContent: 'flex-end' },
  rowLeft:  { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleMe:   { backgroundColor: '#0084FF', borderBottomRightRadius: 4 },
  bubblePeer: { backgroundColor: '#F0F0F0', borderBottomLeftRadius: 4 },
  text: { fontSize: 16, lineHeight: 22 },
  image: { width: 220, height: 220, borderRadius: 12 },
  textMe:   { color: '#FFFFFF' },
  textPeer: { color: '#1A1A1A' },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, alignSelf: 'flex-end' },
  time: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginRight: 4 },
  status: { fontSize: 12, color: 'rgba(255,255,255,0.9)' },
});

export default MessageBubble;
