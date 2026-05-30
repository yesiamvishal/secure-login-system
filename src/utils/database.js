const { DatabaseSync } = require('node:sqlite');
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './database.sqlite';

let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA journal_mode = WAL');
    console.log('Connected to SQLite database.');
  }
  return db;
}

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    try {
      const database = getDb();

      database.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          is_verified INTEGER DEFAULT 0,
          is_locked INTEGER DEFAULT 0,
          failed_attempts INTEGER DEFAULT 0,
          lockout_until INTEGER DEFAULT NULL,
          two_factor_secret TEXT DEFAULT NULL,
          two_factor_enabled INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          last_login INTEGER DEFAULT NULL
        );

        CREATE TABLE IF NOT EXISTS login_audit (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT,
          username TEXT,
          action TEXT NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          success INTEGER DEFAULT 0,
          timestamp INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          token TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          used INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL
        );
      `);

      console.log('Database initialized successfully.');
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = getDb().prepare(sql);
      const result = stmt.run(...params);
      resolve({ lastID: result.lastInsertRowid, changes: result.changes });
    } catch (err) {
      reject(err);
    }
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = getDb().prepare(sql);
      const row = stmt.get(...params);
      resolve(row || null);
    } catch (err) {
      reject(err);
    }
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = getDb().prepare(sql);
      const rows = stmt.all(...params);
      resolve(rows);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { initializeDatabase, dbRun, dbGet, dbAll, getDb };
