import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Plus, Sun, Search } from 'lucide-react';
import { useMyDayTasks, useRemoveFromMyDay, useReorderMyDay, useTasks, useAddToMyDay, useSprints, useStatuses, useCreateTask } from '@/hooks';
import { useUIStore } from '@/store';
import { cn } from '@/lib/utils';
import { TaskQuickActions } from './TaskQuickActions';
import type { Task } from '@/types';

// ── Sortable Task Row ──

function SortableTaskRow({ task, onOpenDetail, onRemove, onToggleDone, isOverdue }: {
  task: Task;
  onOpenDetail: (id: number) => void;
  onRemove: (id: number) => void;
  onToggleDone: (task: Task) => void;
  isOverdue?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const { data: sprints = [] } = useSprints();
  const style = { transform: CSS.Transform.toString(transform), transition };
  const sprint = task.sprint_id ? sprints.find(s => s.id === task.sprint_id) : null;

  const isDone = task.subtasks?.length
    ? task.subtasks.every(s => s.is_completed)
    : false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 px-4 py-3 bg-card rounded-lg border border-card-border group',
        'hover:border-accent/50 transition-colors',
        isDragging && 'opacity-50 shadow-lg',
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        tabIndex={-1}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Checkbox */}
      <button
        onClick={() => onToggleDone(task)}
        className={cn(
          'h-4 w-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors',
          isDone
            ? 'bg-accent border-accent text-white'
            : 'border-muted-foreground/40 hover:border-accent',
        )}
      >
        {isDone && (
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 6l3 3 5-5" />
          </svg>
        )}
      </button>

      {/* Title + labels */}
      <button
        onClick={() => onOpenDetail(task.id)}
        className="flex-1 text-left truncate text-sm text-foreground hover:text-accent transition-colors"
      >
        {task.is_priority ? '❗️ ' : ''}{task.is_quick ? '⚡️ ' : ''}{task.requires_other ? <span title={task.requires_other_note || 'Requires other'} className="cursor-help">🪢 </span> : ''}{task.title}
      </button>

      {/* Overdue badge */}
      {isOverdue && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 flex-shrink-0 font-medium">
          Overdue
        </span>
      )}

      {/* Labels */}
      {task.labels?.length > 0 && (
        <div className="flex gap-1 flex-shrink-0">
          {task.labels.map(l => (
            <span
              key={l.id}
              className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: `${l.color}20`, color: l.color }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} />
              {l.name}
            </span>
          ))}
        </div>
      )}

      {/* Sprint */}
      {sprint && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary flex-shrink-0">
          {sprint.name}
        </span>
      )}

      {/* Effort */}
      {task.effort_estimate != null && (
        <span className="text-xs text-muted-foreground flex-shrink-0">{task.effort_estimate}h</span>
      )}

      {/* Quick actions (complete + delete) */}
      <TaskQuickActions taskId={task.id} size="xs" />

      {/* Remove from My Day */}
      <button
        onClick={() => onRemove(task.id)}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-opacity"
        title="Remove from My Day"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Add Task Picker (modal-like dropdown) ──

function AddTaskPicker({ onAdd, onClose, existingIds }: {
  onAdd: (taskId: number) => void;
  onClose: () => void;
  existingIds: Set<number>;
}) {
  const [search, setSearch] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const { data: allTasks = [] } = useTasks({
    is_archived: 0,
    search: search || undefined,
  });
  const createTask = useCreateTask();

  const candidates = useMemo(
    () => allTasks.filter((t: Task) => !existingIds.has(t.id)),
    [allTasks, existingIds],
  );

  const handleCreateNew = () => {
    const title = newTitle.trim();
    if (!title) return;
    const today = new Date().toISOString().split('T')[0];
    createTask.mutate({ title, do_date: today }, {
      onSuccess: (task: any) => {
        onAdd(task.id);
        onClose();
      },
    });
  };

  return (
    <div className="absolute top-full left-0 mt-2 w-96 bg-card border border-card-border rounded-lg shadow-xl z-50">
      {/* Create new task */}
      <div className="p-3 border-b border-card-border">
        <div className="relative">
          <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateNew(); }}
            placeholder="Create new task for today..."
            className="w-full pl-9 pr-3 py-2 bg-secondary rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>
      {/* Search existing tasks */}
      <div className="p-3 border-b border-card-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search existing tasks to add..."
            className="w-full pl-9 pr-3 py-2 bg-secondary rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>
      <div className="max-h-60 overflow-y-auto p-2">
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No tasks found</p>
        ) : (
          candidates.slice(0, 20).map((t: Task) => (
            <button
              key={t.id}
              onClick={() => { onAdd(t.id); onClose(); }}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-secondary text-sm text-foreground truncate"
            >
              {t.title}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main Component ──

export function MyDaySpace() {
  const { openTaskDetail } = useUIStore();
  const { data: tasks = [], isLoading } = useMyDayTasks();
  const { data: statuses = [] } = useStatuses();
  const removeFromMyDay = useRemoveFromMyDay();
  const reorderMyDay = useReorderMyDay();
  const addToMyDay = useAddToMyDay();

  const [pickerOpen, setPickerOpen] = useState(false);

  // Group tasks by status, with "Done" status last
  const statusMap = useMemo(() => new Map(statuses.map(s => [s.id, s])), [statuses]);
  const doneStatusId = useMemo(() => statuses.find(s => s.name === 'Done')?.id, [statuses]);

  // Filter: show today's tasks (any status) + overdue tasks (not Done)
  const today = new Date().toISOString().split('T')[0];
  const filtered = useMemo(() => {
    return tasks.filter((t: Task) => {
      if (t.do_date === today) return true; // today's tasks always shown
      // overdue: do_date < today and not completed
      return t.do_date && t.do_date < today && t.status_id !== doneStatusId;
    });
  }, [tasks, today, doneStatusId]);

  const sorted = useMemo(
    () => [...filtered].sort((a: Task, b: Task) => (a.my_day_order ?? 999) - (b.my_day_order ?? 999)),
    [filtered],
  );

  const statusGroups = useMemo(() => {
    const groups = new Map<number, Task[]>();
    for (const task of sorted) {
      const list = groups.get(task.status_id) || [];
      list.push(task);
      groups.set(task.status_id, list);
    }
    // Sort groups: non-Done statuses first (by status sort_order), Done last
    const entries = [...groups.entries()].sort(([aId], [bId]) => {
      const aIsDone = aId === doneStatusId;
      const bIsDone = bId === doneStatusId;
      if (aIsDone !== bIsDone) return aIsDone ? 1 : -1;
      const aOrder = statusMap.get(aId)?.sort_order ?? 999;
      const bOrder = statusMap.get(bId)?.sort_order ?? 999;
      return aOrder - bOrder;
    });
    return entries;
  }, [sorted, statusMap, doneStatusId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sorted.findIndex(t => t.id === active.id);
      const newIndex = sorted.findIndex(t => t.id === over.id);
      const newOrder = arrayMove(sorted, oldIndex, newIndex);
      reorderMyDay.mutate(newOrder.map(t => t.id));
    },
    [sorted, reorderMyDay],
  );

  const handleRemove = useCallback(
    (taskId: number) => removeFromMyDay.mutate(taskId),
    [removeFromMyDay],
  );

  const handleToggleDone = useCallback(
    (task: Task) => {
      // Toggle by updating status — find "Done" status or leave for now
      // For simplicity, we'll handle this via detail panel
      openTaskDetail(task.id);
    },
    [openTaskDetail],
  );

  const handleAddToDay = useCallback(
    (taskId: number) => addToMyDay.mutate(taskId),
    [addToMyDay],
  );

  const existingIds = useMemo(() => new Set(sorted.map(t => t.id)), [sorted]);

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const totalEffort = sorted.reduce((sum, t) => sum + (t.effort_estimate || 0), 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-5 pb-3">
        <div className="flex items-center gap-3 mb-1">
          <Sun className="h-6 w-6 text-yellow-400" />
          <h2 className="text-xl font-semibold text-foreground">My Day</h2>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{dateStr}</span>
          <span>{sorted.length} task{sorted.length !== 1 ? 's' : ''}</span>
          {totalEffort > 0 && <span>{totalEffort}h planned</span>}
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-6 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Loading...</div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
            <Sun className="h-10 w-10 opacity-30" />
            <p className="text-sm">No tasks for today</p>
            <p className="text-xs">Add tasks to plan your day</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sorted.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {statusGroups.map(([statusId, groupTasks]) => {
                  const status = statusMap.get(statusId);
                  return (
                    <div key={statusId}>
                      <div className="flex items-center gap-2 px-1 py-1.5 mb-1 mt-2 first:mt-0">
                        <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: status?.color || '#6b7280' }} />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{status?.name || 'Unknown'}</span>
                        <span className="text-xs text-muted-foreground/50">{groupTasks.length}</span>
                      </div>
                      {groupTasks.map(task => (
                        <div key={task.id} className="mb-2">
                          <SortableTaskRow
                            task={task}
                            onOpenDetail={openTaskDetail}
                            onRemove={handleRemove}
                            onToggleDone={handleToggleDone}
                            isOverdue={!!task.do_date && task.do_date < today}
                          />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Add task button */}
        <div className="relative mt-4">
          <button
            onClick={() => setPickerOpen(!pickerOpen)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-muted-foreground/30 hover:border-accent/50 text-muted-foreground hover:text-accent text-sm transition-colors w-full"
          >
            <Plus className="h-4 w-4" />
            Add task to My Day
          </button>
          {pickerOpen && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
              <AddTaskPicker
                onAdd={handleAddToDay}
                onClose={() => setPickerOpen(false)}
                existingIds={existingIds}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
