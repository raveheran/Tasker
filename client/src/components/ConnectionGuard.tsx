import { useEffect, useCallback } from 'react';
import { WifiOff, X, AlertTriangle, AlertCircle, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConnectionStore, type Toast } from '@/store';
import { checkHealth } from '@/api';

const HEALTH_INTERVAL = 15_000; // 15 seconds

/**
 * Monitors server connectivity and displays:
 * 1. A persistent banner when the server is unreachable
 * 2. Toast notifications for save errors
 */
export function ConnectionGuard() {
  const { serverOnline, setServerOnline, toasts, dismissToast } = useConnectionStore();

  const runCheck = useCallback(async () => {
    const ok = await checkHealth();
    setServerOnline(ok);
  }, [setServerOnline]);

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

      {/* Toast stack */}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </>
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
