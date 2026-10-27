import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Layers, AlertTriangle, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspaces } from '@/hooks';
import { useUIStore } from '@/store';
import { getActiveWorkspaceId, switchWorkspace } from '@/lib/workspace';

/** Give in-flight saves a moment to land before the page reloads into another workspace. */
async function waitForPendingSaves(isMutating: () => number, timeoutMs = 3000) {
  const start = Date.now();
  while (isMutating() > 0 && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 50));
  }
}

/**
 * Compact workspace menu in the sidebar header (opposite the logo).
 * The dropdown anchors to the header row (`relative` in Sidebar), spanning the sidebar's width.
 */
export function WorkspaceSwitcher() {
  const { data: workspaces = [] } = useWorkspaces();
  const { setActiveSpace } = useUIStore();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeId = getActiveWorkspaceId();
  const active = workspaces.find((w) => w.id === activeId);

  // Document title shows the workspace, so several tabs are distinguishable
  useEffect(() => {
    document.title = active ? `${active.name} — Tasker` : 'Tasker';
  }, [active]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function handleSwitch(id: string) {
    if (id === activeId || switching) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    // Commit any field being edited (saves on blur), then wait for saves to finish
    (document.activeElement as HTMLElement | null)?.blur?.();
    await waitForPendingSaves(() => queryClient.isMutating());
    switchWorkspace(id);
  }

  function openSettings() {
    setOpen(false);
    setActiveSpace('settings');
  }

  const label = active?.name ?? 'Workspace';

  return (
    <div ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={`Workspace: ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex items-center gap-1 h-7 pl-1.5 pr-1 max-w-[108px] rounded-md text-xs transition-colors',
          'text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent',
          open && 'bg-sidebar-accent text-foreground',
        )}
      >
        <Layers className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-70" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-2 right-2 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl py-1 animate-in fade-in-0 zoom-in-95"
        >
          <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Workspaces
          </div>
          <div className="max-h-64 overflow-y-auto">
            {workspaces.map((w) => {
              const isActive = w.id === activeId;
              const unavailable = w.status !== 'ok';
              return (
                <button
                  key={w.id}
                  role="menuitem"
                  disabled={unavailable && !isActive}
                  onClick={() => handleSwitch(w.id)}
                  title={unavailable ? w.error : w.path}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors',
                    'text-foreground hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed',
                  )}
                >
                  <span className="w-3.5 flex-shrink-0">
                    {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
                  </span>
                  <span className="flex-1 truncate">{w.name}</span>
                  {unavailable && <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-yellow-400" />}
                </button>
              );
            })}
          </div>
          <div className="h-px bg-border my-1" />
          <button
            role="menuitem"
            onClick={openSettings}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-left"
          >
            <Settings className="h-3.5 w-3.5" />
            Manage workspaces…
          </button>
        </div>
      )}
    </div>
  );
}
