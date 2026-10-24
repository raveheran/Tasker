import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Store DB in a local directory to avoid cloud-sync filesystem issues (OneDrive, etc.)
const LOCAL_DATA_DIR = path.join(os.homedir(), '.tasker');
if (!fs.existsSync(LOCAL_DATA_DIR)) {
  fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
}
const DB_PATH = path.join(LOCAL_DATA_DIR, 'tasker.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Run schema (split on ALTER TABLE statements so they can fail gracefully)
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    const parts = schema.split(/^(ALTER TABLE[^;]*;)/m);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('ALTER TABLE')) {
        try { db.exec(trimmed); } catch { /* column may already exist */ }
      } else {
        db.exec(trimmed);
      }
    }
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
