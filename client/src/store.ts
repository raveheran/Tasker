import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SpaceName, TaskViewMode } from './types';

interface UIState {
  activeSpace: SpaceName;
  taskViewMode: TaskViewMode;
  selectedTaskId: number | null;
  taskDetailOpen: boolean;
  taskDetailWidth: number;
  quickAddOpen: boolean;
  selectedNoteId: number | null;
  selectedStoryId: number | null;

  setActiveSpace: (space: SpaceName) => void;
  setTaskViewMode: (mode: TaskViewMode) => void;
  openTaskDetail: (id: number) => void;
  closeTaskDetail: () => void;
  setTaskDetailWidth: (width: number) => void;
  setQuickAddOpen: (open: boolean) => void;
  setSelectedNoteId: (id: number | null) => void;
  setSelectedStoryId: (id: number | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeSpace: 'dashboard',
      taskViewMode: 'table',
      selectedTaskId: null,
      taskDetailOpen: false,
      taskDetailWidth: 600,
      quickAddOpen: false,
      selectedNoteId: null,
      selectedStoryId: null,

      setActiveSpace: (space) => set({ activeSpace: space }),
      setTaskViewMode: (mode) => set({ taskViewMode: mode }),
      openTaskDetail: (id) => set({ selectedTaskId: id, taskDetailOpen: true }),
      closeTaskDetail: () => set({ taskDetailOpen: false, selectedTaskId: null }),
      setTaskDetailWidth: (width) => set({ taskDetailWidth: width }),
      setQuickAddOpen: (open) => set({ quickAddOpen: open }),
      setSelectedNoteId: (id) => set({ selectedNoteId: id }),
      setSelectedStoryId: (id) => set({ selectedStoryId: id }),
    }),
    {
      name: 'tasker-ui',
      partialize: (state) => ({ activeSpace: state.activeSpace, taskViewMode: state.taskViewMode, taskDetailWidth: state.taskDetailWidth }),
    },
  ),
);

// ── Filter state ──

export type SortField = 'created_at' | 'do_date' | 'sprint' | 'label' | 'title';
export type SortDir = 'asc' | 'desc';
export type KanbanGroupBy = 'status' | 'label' | 'do_date';

interface FilterState {
  statusId: number | undefined;
  sprintId: number | undefined;
  labelId: number | undefined;
  searchText: string;
  statusPhase: string | undefined;
  sortField: SortField;
  sortDir: SortDir;
  kanbanGroupBy: KanbanGroupBy;
  kanbanHideCompleted: boolean;

  setStatusId: (id: number | undefined) => void;
  setSprintId: (id: number | undefined) => void;
  setLabelId: (id: number | undefined) => void;
  setSearchText: (text: string) => void;
  setStatusPhase: (phase: string | undefined) => void;
  setSortField: (field: SortField) => void;
  setSortDir: (dir: SortDir) => void;
  setKanbanGroupBy: (groupBy: KanbanGroupBy) => void;
  setKanbanHideCompleted: (hide: boolean) => void;
  clearFilters: () => void;
}

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      statusId: undefined,
      sprintId: undefined,
      labelId: undefined,
      searchText: '',
      statusPhase: undefined,
      sortField: 'created_at',
      sortDir: 'desc',
      kanbanGroupBy: 'status',
      kanbanHideCompleted: false,

      setStatusId: (id) => set({ statusId: id }),
      setSprintId: (id) => set({ sprintId: id }),
      setLabelId: (id) => set({ labelId: id }),
      setSearchText: (text) => set({ searchText: text }),
      setStatusPhase: (phase) => set({ statusPhase: phase }),
      setSortField: (field) => set({ sortField: field }),
      setSortDir: (dir) => set({ sortDir: dir }),
      setKanbanGroupBy: (groupBy) => set({ kanbanGroupBy: groupBy }),
      setKanbanHideCompleted: (hide) => set({ kanbanHideCompleted: hide }),
      clearFilters: () =>
        set({ statusId: undefined, sprintId: undefined, labelId: undefined, searchText: '', statusPhase: undefined, sortField: 'created_at', sortDir: 'desc' }),
    }),
    {
      name: 'tasker-filters',
      partialize: (state) => ({
        statusId: state.statusId,
        sprintId: state.sprintId,
        labelId: state.labelId,
        statusPhase: state.statusPhase,
        sortField: state.sortField,
        sortDir: state.sortDir,
        kanbanGroupBy: state.kanbanGroupBy,
        kanbanHideCompleted: state.kanbanHideCompleted,
      }),
    },
  ),
);

// ── Connection & error state ──

export interface Toast {
  id: number;
  message: string;
  type: 'error' | 'warning' | 'success';
  timestamp: number;
  onUndo?: () => void;
}

interface ConnectionState {
  serverOnline: boolean;
  toasts: Toast[];
  setServerOnline: (online: boolean) => void;
  addToast: (message: string, type: Toast['type'], onUndo?: () => void) => void;
  dismissToast: (id: number) => void;
}

let toastId = 0;

export const useConnectionStore = create<ConnectionState>((set) => ({
  serverOnline: true,
  toasts: [],
  setServerOnline: (online) => set({ serverOnline: online }),
  addToast: (message, type, onUndo) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, message, type, timestamp: Date.now(), onUndo }] }));
    // Auto-dismiss after 6 seconds (8 for undo toasts)
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, onUndo ? 8000 : 6000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
