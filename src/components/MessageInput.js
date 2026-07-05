import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';

const MessageInput = ({ onSend, onAttach, disabled }) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <View style={styles.container}>
      {onAttach && (
        <TouchableOpacity
          style={[styles.attachButton, disabled && styles.attachDisabled]}
          onPress={onAttach}
          disabled={disabled}
        >
          <Text style={styles.attachIcon}>📷</Text>
        </TouchableOpacity>
      )}
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Message"
        placeholderTextColor="#999"
        multiline
        maxLength={4000}
        editable={!disabled}
        returnKeyType="send"
        onSubmitEditing={Platform.OS === 'ios' ? handleSend : undefined}
        blurOnSubmit={false}
      />
      <TouchableOpacity
        style={[styles.sendButton, (!text.trim() || disabled) && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={!text.trim() || disabled}
      >
        <Text style={styles.sendButtonText}>Send</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#F8F8F8',
    color: '#1A1A1A',
  },
  sendButton: {
    marginLeft: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#0084FF',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#CCCCCC' },
  sendButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  attachButton: {
    marginRight: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachDisabled: { opacity: 0.4 },
  attachIcon: { fontSize: 18 },
});

export default MessageInput;
