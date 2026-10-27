import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import {
  DATA_DIR, DB_FILENAME, DEFAULT_WORKSPACE_ID,
  openWorkspaceDb, closeWorkspaceDb, runInWorkspace,
} from './db';

/**
 * Workspace registry.
 *
 * Each workspace is an independent database folder:
 *   default      → DATA_DIR itself (the original ~/.tasker/tasker.db — registered in place, never moved)
 *   everything else → DATA_DIR/workspaces/<id>/
 * The registry file only stores id, display name and creation time; a workspace's location is always
 * derived from its id, so renaming never touches files and a hand-edited registry can't point elsewhere.
 */

const REGISTRY_PATH = path.join(DATA_DIR, 'workspaces.json');
const WORKSPACES_DIR = path.join(DATA_DIR, 'workspaces');
const TRASH_DIR = path.join(DATA_DIR, 'trash');

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_NAME_LENGTH = 60;

export interface WorkspaceRecord {
  id: string;
  name: string;
  created_at: string;
}

export interface WorkspaceInfo extends WorkspaceRecord {
  is_default: boolean;
  /** Absolute folder on disk */
  path: string;
  status: 'ok' | 'missing' | 'error';
  error?: string;
  task_count?: number;
  last_modified?: string | null;
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

let registry: WorkspaceRecord[] = [];

export function workspaceDir(id: string): string {
  return id === DEFAULT_WORKSPACE_ID ? DATA_DIR : path.join(WORKSPACES_DIR, id);
}

// ── Registry persistence ──

function defaultRecord(): WorkspaceRecord {
  let created = new Date();
  try { created = fs.statSync(path.join(DATA_DIR, DB_FILENAME)).birthtime; } catch { /* fresh install */ }
  return { id: DEFAULT_WORKSPACE_ID, name: 'Default', created_at: created.toISOString() };
}

function saveRegistry(): void {
  const tmp = `${REGISTRY_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, workspaces: registry }, null, 2), 'utf-8');
  fs.renameSync(tmp, REGISTRY_PATH);
}

/** Registry rebuilt from the folders on disk, used when the registry file is unreadable. */
function rebuildRegistry(): WorkspaceRecord[] {
  const found: WorkspaceRecord[] = [defaultRecord()];
  try {
    for (const entry of fs.readdirSync(WORKSPACES_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory() || !ID_PATTERN.test(entry.name)) continue;
      const dbFile = path.join(WORKSPACES_DIR, entry.name, DB_FILENAME);
      if (!fs.existsSync(dbFile)) continue;
      found.push({ id: entry.name, name: entry.name, created_at: fs.statSync(dbFile).birthtime.toISOString() });
    }
  } catch { /* no workspaces folder yet */ }
  return found;
}

export function initWorkspaces(): void {
  let loaded: WorkspaceRecord[] | null = null;
  let dirty = false;

  if (fs.existsSync(REGISTRY_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
      if (!Array.isArray(parsed?.workspaces)) throw new Error('invalid registry');
      loaded = parsed.workspaces;
    } catch {
      const backup = `${REGISTRY_PATH}.corrupt-${Date.now()}`;
      try { fs.copyFileSync(REGISTRY_PATH, backup); } catch { /* ignore */ }
      console.warn(`  ⚠ workspaces.json was unreadable; rebuilt it from disk (old file kept as ${path.basename(backup)})`);
      loaded = rebuildRegistry();
      dirty = true;
    }
  } else {
    dirty = true;
  }

  const seen = new Set<string>();
  const clean: WorkspaceRecord[] = [];
  for (const rec of loaded ?? [defaultRecord()]) {
    if (!rec || typeof rec.id !== 'string' || !ID_PATTERN.test(rec.id) || seen.has(rec.id)) { dirty = true; continue; }
    const name = typeof rec.name === 'string' && rec.name.trim() ? rec.name.trim().slice(0, MAX_NAME_LENGTH) : rec.id;
    const created_at = typeof rec.created_at === 'string' ? rec.created_at : new Date().toISOString();
    seen.add(rec.id);
    clean.push({ id: rec.id, name, created_at });
  }
  if (!seen.has(DEFAULT_WORKSPACE_ID)) { clean.unshift(defaultRecord()); dirty = true; }

  registry = clean;
  if (dirty) saveRegistry();
}

// ── Queries ──

function findRecord(id: string): WorkspaceRecord | undefined {
  return registry.find((w) => w.id === id);
}

function describe(rec: WorkspaceRecord, withStats: boolean): WorkspaceInfo {
  const dir = workspaceDir(rec.id);
  const isDefault = rec.id === DEFAULT_WORKSPACE_ID;
  const dbFile = path.join(dir, DB_FILENAME);
  const exists = fs.existsSync(dbFile);

  const info: WorkspaceInfo = {
    ...rec,
    is_default: isDefault,
    path: dir,
    // A brand-new default workspace has no file until first use; that is normal.
    status: exists || isDefault ? 'ok' : 'missing',
  };
  if (info.status === 'missing') info.error = 'Database file not found';

  if (withStats && exists) {
    try {
      const db = openWorkspaceDb(dir, { create: false });
      info.task_count = (db.prepare('SELECT COUNT(*) AS n FROM tasks WHERE is_archived = 0').get() as { n: number }).n;
      let latest = 0;
      for (const f of [dbFile, `${dbFile}-wal`]) {
        try { latest = Math.max(latest, fs.statSync(f).mtimeMs); } catch { /* wal may not exist */ }
      }
      info.last_modified = latest ? new Date(latest).toISOString() : null;
    } catch (e: any) {
      info.status = 'error';
      info.error = e?.message || 'Could not open database';
    }
  }
  return info;
}

export function listWorkspaces(withStats: boolean): WorkspaceInfo[] {
  return registry.map((rec) => describe(rec, withStats));
}

// ── Mutations ──

function normalizeName(raw: unknown, exceptId?: string): string {
  if (typeof raw !== 'string') throw new HttpError(400, 'INVALID_NAME', 'Workspace name is required');
  const name = raw.trim();
  if (!name) throw new HttpError(400, 'INVALID_NAME', 'Workspace name is required');
  if (name.length > MAX_NAME_LENGTH) throw new HttpError(400, 'INVALID_NAME', `Workspace name must be at most ${MAX_NAME_LENGTH} characters`);
  if (/[\u0000-\u001f\u007f]/.test(name)) throw new HttpError(400, 'INVALID_NAME', 'Workspace name contains invalid characters');
  const lower = name.toLowerCase();
  if (registry.some((w) => w.id !== exceptId && w.name.toLowerCase() === lower)) {
    throw new HttpError(409, 'NAME_TAKEN', `A workspace named "${name}" already exists`);
  }
  return name;
}

/** Safety net: only ever remove/move folders that live under DATA_DIR/workspaces/. */
function assertManagedDir(dir: string): void {
  const rel = path.relative(WORKSPACES_DIR, dir);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new HttpError(500, 'UNSAFE_PATH', 'Refusing to modify a folder outside the workspaces directory');
  }
}

function newId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/, '') || 'workspace';
  for (;;) {
    const id = `${slug}-${crypto.randomBytes(3).toString('hex')}`;
    if (!findRecord(id) && !fs.existsSync(workspaceDir(id))) return id;
  }
}

export function createWorkspace(rawName: unknown): WorkspaceInfo {
  const name = normalizeName(rawName);
  const id = newId(name);
  const dir = workspaceDir(id);
  assertManagedDir(dir);

  fs.mkdirSync(dir, { recursive: true });
  try {
    // Creates the database with the standard schema and default statuses/templates/settings.
    openWorkspaceDb(dir, { create: true });
    fs.mkdirSync(path.join(dir, 'uploads'), { recursive: true });
  } catch (e: any) {
    // The folder was created a moment ago by this call, so removing it cannot touch existing data.
    closeWorkspaceDb(dir);
    fs.rmSync(dir, { recursive: true, force: true });
    throw new HttpError(500, 'CREATE_FAILED', `Could not create workspace: ${e?.message || e}`);
  }

  const rec: WorkspaceRecord = { id, name, created_at: new Date().toISOString() };
  registry.push(rec);
  saveRegistry();
  return describe(rec, true);
}

export function renameWorkspace(id: string, rawName: unknown): WorkspaceInfo {
  const rec = findRecord(id);
  if (!rec) throw new HttpError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
  rec.name = normalizeName(rawName, id);
  saveRegistry();
  return describe(rec, true);
}

/**
 * Delete = unregister and move the folder to DATA_DIR/trash/ (never erased outright).
 * The default workspace (the original data) is protected and can never be deleted here.
 */
export function deleteWorkspace(id: string, confirmName: unknown, callerWorkspaceId: string): { trashed_to: string | null } {
  if (id === DEFAULT_WORKSPACE_ID) {
    throw new HttpError(403, 'DEFAULT_PROTECTED', 'The Default workspace holds your original data and cannot be deleted');
  }
  const rec = findRecord(id);
  if (!rec) throw new HttpError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
  if (callerWorkspaceId === id) {
    throw new HttpError(409, 'WORKSPACE_IN_USE', 'Switch to another workspace before deleting this one');
  }
  if (confirmName !== rec.name) {
    throw new HttpError(400, 'CONFIRMATION_MISMATCH', 'Confirmation name does not match the workspace name');
  }
  if (registry.length <= 1) {
    throw new HttpError(409, 'LAST_WORKSPACE', 'The last remaining workspace cannot be deleted');
  }

  const dir = workspaceDir(id);
  assertManagedDir(dir);
  closeWorkspaceDb(dir);

  let trashedTo: string | null = null;
  if (fs.existsSync(dir)) {
    fs.mkdirSync(TRASH_DIR, { recursive: true });
    trashedTo = path.join(TRASH_DIR, `${id}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    try {
      fs.renameSync(dir, trashedTo);
    } catch (e: any) {
      throw new HttpError(500, 'DELETE_FAILED', `Could not move the workspace folder to trash: ${e?.message || e}`);
    }
  }

  registry = registry.filter((w) => w.id !== id);
  saveRegistry();
  return { trashed_to: trashedTo };
}

// ── Request routing ──

/**
 * Picks the workspace for each API request: `X-Workspace` header, or `?ws=` for URLs the browser
 * fetches itself (images, downloads). No selector means the default workspace, so existing links
 * (e.g. images embedded in old notes) and scripts keep working unchanged.
 */
export function workspaceContext(req: Request, res: Response, next: NextFunction): void {
  const headerValue = req.header('x-workspace');
  const queryValue = typeof req.query.ws === 'string' ? req.query.ws : undefined;
  const id = (headerValue || queryValue || '').trim() || DEFAULT_WORKSPACE_ID;

  const rec = findRecord(id);
  if (!rec) {
    res.status(404).json({ error: `Workspace "${id}" no longer exists`, code: 'WORKSPACE_NOT_FOUND' });
    return;
  }

  const dir = workspaceDir(id);
  try {
    openWorkspaceDb(dir, { create: id === DEFAULT_WORKSPACE_ID });
  } catch (e: any) {
    res.status(503).json({ error: `Workspace "${rec.name}" cannot be opened: ${e?.message || e}`, code: 'WORKSPACE_UNAVAILABLE' });
    return;
  }

  runInWorkspace({ id, name: rec.name, dir }, () => next());
}
