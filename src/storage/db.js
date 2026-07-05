import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

let db = null;

export const getDB = async () => {
  if (db) return db;

  db = await SQLite.openDatabase({ name: 'p2pchat.db', location: 'default' });

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS messages (
      id          TEXT PRIMARY KEY,
      text        TEXT NOT NULL,
      from_peer   INTEGER NOT NULL,
      status      TEXT NOT NULL,
      timestamp   INTEGER NOT NULL,
      nonce       TEXT,
      kind        TEXT DEFAULT 'text'
    );
  `);

  // Migration for databases created before the kind column existed
  try {
    await db.executeSql(`ALTER TABLE messages ADD COLUMN kind TEXT DEFAULT 'text'`);
  } catch (e) {
    // column already exists
  }

  return db;
};

export const closeDB = async () => {
  if (db) {
    await db.close();
    db = null;
  }
};
