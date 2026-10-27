import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { AsyncLocalStorage } from 'async_hooks';

// Root data directory. Kept outside the project to avoid cloud-sync filesystem issues (OneDrive, etc.).
// TASKER_HOME overrides it (used for tests and portable setups).
export const DATA_DIR = process.env.TASKER_HOME
  ? path.resolve(process.env.TASKER_HOME)
  : path.join(os.homedir(), '.tasker');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const DB_FILENAME = 'tasker.db';
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

/** The original workspace: lives directly in DATA_DIR, exactly where Tasker always kept its data. */
export const DEFAULT_WORKSPACE_ID = 'default';

export interface WorkspaceContext {
  id: string;
  name: string;
  /** Absolute folder holding this workspace's tasker.db and uploads/ */
  dir: string;
}

export class WorkspaceUnavailableError extends Error {}

const requestContext = new AsyncLocalStorage<WorkspaceContext>();
const pool = new Map<string, Database.Database>();

/** Run `fn` (and everything it triggers asynchronously) against the given workspace. */
export function runInWorkspace<T>(ctx: WorkspaceContext, fn: () => T): T {
  return requestContext.run(ctx, fn);
}

/** The workspace of the current request; the default workspace outside of a request. */
export function currentWorkspace(): WorkspaceContext {
  return requestContext.getStore() ?? { id: DEFAULT_WORKSPACE_ID, name: 'Default', dir: DATA_DIR };
}

/**
 * Open (or reuse) the database stored in `dir`.
 * With `create: false` a missing database file is an error instead of silently creating an empty one.
 */
export function openWorkspaceDb(dir: string, opts: { create: boolean }): Database.Database {
  const key = path.resolve(dir);
  const existing = pool.get(key);
  if (existing && existing.open) return existing;

  const dbPath = path.join(key, DB_FILENAME);
  if (!opts.create && !fs.existsSync(dbPath)) {
    throw new WorkspaceUnavailableError(`Database file not found: ${dbPath}`);
  }

  let db: Database.Database | undefined;
  try {
    if (opts.create) fs.mkdirSync(key, { recursive: true });
    db = new Database(dbPath, { fileMustExist: !opts.create });
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
  } catch (e: any) {
    try { db?.close(); } catch { /* ignore */ }
    throw new WorkspaceUnavailableError(e?.message || 'Could not open database');
  }

  pool.set(key, db);
  return db;
}

/** Database of the current request's workspace. */
export function getDb(): Database.Database {
  const ctx = currentWorkspace();
  return openWorkspaceDb(ctx.dir, { create: ctx.id === DEFAULT_WORKSPACE_ID });
}

/** Close one workspace's connection (e.g. before its folder is moved). */
export function closeWorkspaceDb(dir: string): void {
  const key = path.resolve(dir);
  const db = pool.get(key);
  if (db) {
    try { db.close(); } catch { /* ignore */ }
    pool.delete(key);
  }
}

/** Close every open workspace database (shutdown). */
export function closeDb(): void {
  for (const db of pool.values()) {
    try { db.close(); } catch { /* ignore */ }
  }
  pool.clear();
}
