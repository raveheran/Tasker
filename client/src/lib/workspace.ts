/**
 * Which workspace this browser tab is working in.
 *
 * Each tab remembers its own workspace in sessionStorage, so two tabs can use two workspaces at the
 * same time. localStorage only records the most recently used workspace, which new tabs start with.
 * Switching reloads the page, which gives the new workspace a clean query cache and UI state.
 */

export const DEFAULT_WORKSPACE_ID = 'default';

const SESSION_KEY = 'tasker-workspace';
const LAST_USED_KEY = 'tasker-last-workspace';
const NOTICE_KEY = 'tasker-notice';

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

function read(storage: 'session' | 'local', key: string): string | null {
  try {
    return (storage === 'session' ? sessionStorage : localStorage).getItem(key);
  } catch {
    return null;
  }
}

function write(storage: 'session' | 'local', key: string, value: string): void {
  try {
    (storage === 'session' ? sessionStorage : localStorage).setItem(key, value);
  } catch { /* storage unavailable: fall back to the default workspace on reload */ }
}

function resolveInitialId(): string {
  const fromSession = read('session', SESSION_KEY);
  const fromLast = read('local', LAST_USED_KEY);
  const id = [fromSession, fromLast].find((v): v is string => !!v && ID_PATTERN.test(v)) ?? DEFAULT_WORKSPACE_ID;
  // Pin it to this tab, so a workspace switch in another tab doesn't change this one
  write('session', SESSION_KEY, id);
  return id;
}

let activeWorkspaceId = resolveInitialId();

export function getActiveWorkspaceId(): string {
  return activeWorkspaceId;
}

/** Headers identifying this tab's workspace on API calls. */
export function workspaceHeaders(): Record<string, string> {
  return { 'X-Workspace': activeWorkspaceId };
}

/** Adds the workspace to URLs the browser requests itself (downloads, images), which can't carry headers. */
export function withWorkspace(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}ws=${encodeURIComponent(activeWorkspaceId)}`;
}

/** localStorage key for UI state that belongs to one workspace (filters, ...). The default keeps its original key. */
export function workspaceStorageKey(base: string): string {
  return activeWorkspaceId === DEFAULT_WORKSPACE_ID ? base : `${base}:${activeWorkspaceId}`;
}

/** Make `id` this tab's workspace and reload so everything restarts cleanly on its data. */
export function switchWorkspace(id: string): void {
  activeWorkspaceId = id;
  write('session', SESSION_KEY, id);
  write('local', LAST_USED_KEY, id);
  window.location.reload();
}

let leaving = false;

/** The server says this tab's workspace no longer exists (deleted elsewhere): fall back to the default. */
export function handleWorkspaceGone(): void {
  if (leaving || activeWorkspaceId === DEFAULT_WORKSPACE_ID) return;
  leaving = true;
  write('session', NOTICE_KEY, 'The workspace you were in was deleted. Switched to the Default workspace.');
  switchWorkspace(DEFAULT_WORKSPACE_ID);
}

/** One-time message to show after a reload (e.g. after falling back to the default workspace). */
export function takeNotice(): string | null {
  const message = read('session', NOTICE_KEY);
  if (message) {
    try { sessionStorage.removeItem(NOTICE_KEY); } catch { /* ignore */ }
  }
  return message;
}
