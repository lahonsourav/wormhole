import { getDB } from './db';

export const saveMessage = async (msg) => {
  const db = await getDB();
  await db.executeSql(
    `INSERT OR REPLACE INTO messages (id, text, from_peer, status, timestamp, nonce, kind)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [msg.id, msg.text, msg.from_peer, msg.status, msg.timestamp, msg.nonce || null, msg.kind || 'text']
  );
};

export const getAllMessages = async () => {
  const db = await getDB();
  const [results] = await db.executeSql(
    'SELECT * FROM messages ORDER BY timestamp ASC'
  );
  const rows = [];
  for (let i = 0; i < results.rows.length; i++) {
    rows.push(results.rows.item(i));
  }
  return rows;
};

export const updateMessageStatus = async (id, status) => {
  const db = await getDB();
  await db.executeSql(
    'UPDATE messages SET status = ? WHERE id = ?',
    [status, id]
  );
};

export const deleteMessage = async (id) => {
  const db = await getDB();
  await db.executeSql('DELETE FROM messages WHERE id = ?', [id]);
};

export const clearAllMessages = async () => {
  const db = await getDB();
  await db.executeSql('DELETE FROM messages');
};
