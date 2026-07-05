import React, { useRef, useEffect } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import MessageBubble from './MessageBubble';

const MessageList = ({ messages }) => {
  const listRef = useRef(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  return (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={item => item.id}
      renderItem={({ item }) => <MessageBubble message={item} />}
      style={styles.list}
      contentContainerStyle={styles.content}
      onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
    />
  );
};

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { paddingVertical: 8 },
});

export default MessageList;
