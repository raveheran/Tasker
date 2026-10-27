import { useEffect, useCallback, useState } from 'react';
import { WifiOff, X, AlertTriangle, AlertCircle, Undo2, DatabaseZap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConnectionStore, type Toast } from '@/store';
import { checkHealth, workspacesApi } from '@/api';
import { DEFAULT_WORKSPACE_ID, getActiveWorkspaceId, switchWorkspace, takeNotice } from '@/lib/workspace';
import type { Workspace } from '@/types';

const HEALTH_INTERVAL = 15_000; // 15 seconds

/**
 * Monitors server connectivity and displays:
 * 1. A persistent banner when the server is unreachable
 * 2. Toast notifications for save errors
 */
export function ConnectionGuard() {
  const { serverOnline, setServerOnline, workspaceError, setWorkspaceError, toasts, dismissToast, addToast } = useConnectionStore();

  const runCheck = useCallback(async () => {
    const health = await checkHealth();
    setServerOnline(health.online);
    setWorkspaceError(health.workspaceError ?? null);
  }, [setServerOnline, setWorkspaceError]);

  // Message left by a workspace fallback (e.g. the workspace was deleted in another tab)
  useEffect(() => {
    const notice = takeNotice();
    if (notice) addToast(notice, 'warning');
  }, [addToast]);

  // Periodic health check
  useEffect(() => {
    runCheck();
    const id = setInterval(runCheck, HEALTH_INTERVAL);
    return () => clearInterval(id);
  }, [runCheck]);

  // Also check on window focus (user returns to tab)
  useEffect(() => {
    const handler = () => runCheck();
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [runCheck]);

  return (
    <>
      {/* Offline banner */}
      {!serverOnline && (
        <div className="fixed top-0 left-0 right-0 z-[200] bg-destructive text-destructive-foreground px-4 py-2.5 flex items-center justify-center gap-2 shadow-lg">
          <WifiOff className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm font-medium">
            Server unreachable — your changes will NOT be saved. Please check the server and refresh.
          </span>
        </div>
      )}

      {/* This tab's workspace database is missing or corrupt */}
      {serverOnline && workspaceError && (
        <WorkspaceUnavailable message={workspaceError} onRetry={runCheck} />
      )}

      {/* Toast stack */}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </>
  );
}

function WorkspaceUnavailable({ message, onRetry }: { message: string; onRetry: () => void }) {
  const [others, setOthers] = useState<Workspace[]>([]);

  useEffect(() => {
    workspacesApi.list().then(setOthers).catch(() => setOthers([]));
  }, []);

  const activeId = getActiveWorkspaceId();
  const alternatives = others.filter((w) => w.id !== activeId && w.status === 'ok');

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-background/95 p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-lg shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-destructive">
          <DatabaseZap className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Workspace unavailable</h2>
        </div>
        <p className="text-sm text-muted-foreground break-words">{message}</p>
        <p className="text-xs text-muted-foreground">
          Nothing was changed or deleted. Switch to another workspace, or restore the database file and retry.
        </p>
        <div className="flex flex-wrap gap-2">
          {alternatives.map((w) => (
            <button
              key={w.id}
              onClick={() => switchWorkspace(w.id)}
              className="h-8 px-3 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90"
            >
              Switch to {w.name}
            </button>
          ))}
          {alternatives.length === 0 && activeId !== DEFAULT_WORKSPACE_ID && (
            <button
              onClick={() => switchWorkspace(DEFAULT_WORKSPACE_ID)}
              className="h-8 px-3 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90"
            >
              Switch to Default
            </button>
          )}
          <button
            onClick={onRetry}
            className="h-8 px-3 bg-secondary text-foreground text-sm rounded-md hover:bg-secondary/80"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const Icon = toast.type === 'error' ? AlertCircle : toast.type === 'success' ? AlertCircle : AlertTriangle;

  return (
    <div
      className={cn(
        'flex items-start gap-2 px-4 py-3 rounded-lg shadow-xl border text-sm animate-in slide-in-from-right-5',
        toast.type === 'error' && 'bg-red-950 border-red-800 text-red-200',
        toast.type === 'warning' && 'bg-yellow-950 border-yellow-800 text-yellow-200',
        toast.type === 'success' && 'bg-green-950 border-green-800 text-green-200',
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
      <span className="flex-1">{toast.message}</span>
      {toast.onUndo && (
        <button
          onClick={() => { toast.onUndo!(); onDismiss(toast.id); }}
          className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-white/10 hover:bg-white/20 transition-colors"
        >
          <Undo2 className="h-3 w-3" />
          Undo
        </button>
      )}
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 opacity-60 hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
