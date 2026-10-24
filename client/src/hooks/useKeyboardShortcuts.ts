import { useEffect } from 'react';
import { useUIStore } from '@/store';

/**
 * Global keyboard shortcuts:
 *  Cmd/Ctrl+K  → Global search
 *  Cmd/Ctrl+N  → Quick add task
 *  Escape      → Close task detail / quick add
 *  1-9         → Navigate spaces (when no input focused)
 */
export function useKeyboardShortcuts() {
  const { setActiveSpace, taskDetailOpen, closeTaskDetail, quickAddOpen, setQuickAddOpen } = useUIStore();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;

      // Cmd+K → focus search (handled by GlobalSearch, but prevent default)
      if (meta && e.key === 'k') {
        e.preventDefault();
        // GlobalSearch already listens for this
        return;
      }

      // Cmd+J → Quick add
      if (meta && e.key === 'j') {
        e.preventDefault();
        setQuickAddOpen(!quickAddOpen);
        return;
      }

      // Escape → close panels
      if (e.key === 'Escape') {
        if (taskDetailOpen) { closeTaskDetail(); return; }
        if (quickAddOpen) { setQuickAddOpen(false); return; }
      }

      // Number keys for space navigation (only when not in input)
      if (!isInput && !meta && !e.altKey && !e.shiftKey) {
        const spaceMap: Record<string, Parameters<typeof setActiveSpace>[0]> = {
          '1': 'dashboard',
          '2': 'tasks',
          '3': 'backlog',
          '4': 'my-day',
          '5': 'user-stories',
          '6': 'notes',
          '7': 'archive',
          '8': 'sprint-overview',
          '9': 'activity',
        };
        if (spaceMap[e.key]) {
          e.preventDefault();
          setActiveSpace(spaceMap[e.key]);
        }
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setActiveSpace, taskDetailOpen, closeTaskDetail, quickAddOpen, setQuickAddOpen]);
}
