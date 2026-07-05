import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'pending_messages';

export const enqueue = async (message) => {
  const queue = await getQueue();
  // Avoid duplicates
  if (!queue.find(m => m.id === message.id)) {
    queue.push({ ...message, retries: (message.retries || 0) });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
};

export const flush = async (sendFn) => {
  const queue = await getQueue();
  if (queue.length === 0) return;

  const failed = [];

  for (const msg of queue) {
    try {
      const delivered = await sendFn(msg.text);
      if (!delivered) {
        failed.push({ ...msg, retries: (msg.retries || 0) + 1 });
      }
    } catch {
      failed.push({ ...msg, retries: (msg.retries || 0) + 1 });
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(failed));
};

export const getQueue = async () => {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
};

export const clearQueue = async () => {
  await AsyncStorage.removeItem(QUEUE_KEY);
};
