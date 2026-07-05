import { useState, useEffect, useCallback } from 'react';
import { getAllMessages, updateMessageStatus } from '../storage/messageStore';

export const useMessages = () => {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    getAllMessages().then(setMessages).catch(console.error);
  }, []);

  const addMessage = useCallback((msg) => {
    if (msg.type === 'ack') {
      setMessages(prev =>
        prev.map(m => m.id === msg.id ? { ...m, status: 'delivered' } : m)
      );
      return;
    }
    setMessages(prev => {
      const exists = prev.find(m => m.id === msg.id);
      if (exists) {
        return prev.map(m => m.id === msg.id ? { ...m, ...msg } : m);
      }
      return [...prev, msg];
    });
  }, []);

  const updateStatus = useCallback(async (id, status) => {
    await updateMessageStatus(id, status);
    setMessages(prev =>
      prev.map(m => m.id === id ? { ...m, status } : m)
    );
  }, []);

  return { messages, addMessage, updateStatus };
};
