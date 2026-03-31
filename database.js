const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'business_assistant.db');

let db;

function getDB() {
  if (!db) throw new Error('Database not initialised. Call initDB() first.');
  return db;
}

async function initDB() {
  const fs = require('fs');
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, err => {
      if (err) {
        console.error('Failed to open database:', err.message);
        return reject(err);
      }
      console.log(`📂  Database connected: ${DB_PATH}`);

      db.serialize(() => {
        // Enable WAL mode for better concurrent performance
        db.run('PRAGMA journal_mode = WAL');
        db.run('PRAGMA foreign_keys = ON');

        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT    NOT NULL,
            is_paid       INTEGER NOT NULL DEFAULT 0,
            trial_end     TEXT    NOT NULL,
            created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
          )
        `, err => {
          if (err) return reject(err);
          console.log('✅  Users table ready');
          resolve(db);
        });
      });
    });
  });
}

module.exports = { initDB, getDB };
