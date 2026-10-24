import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { useTasks, useStatuses, useUpdateTask, useCreateTask, useSprints, useLabels, useTemplates, useCreateTaskFromTemplate, useReorderKanban } from '@/hooks';
import { useUIStore, useFilterStore, useConnectionStore, type KanbanGroupBy } from '@/store';
import { FilterBar } from './FilterBar';
import { TaskContextMenu } from './TaskContextMenu';
import { TaskQuickActions } from './TaskQuickActions';
import { LabelPill } from './LabelPill';
import { sortTasks } from '@/lib/sortTasks';
import type { Task, Status } from '@/types';
import { MessageSquare, CheckSquare, Plus, FileText, EyeOff, Eye, ArrowRightToLine } from 'lucide-react';
import {
  startOfDay, addDays, format, isThursday,
  nextThursday, nextSunday, isAfter, isBefore, isSameDay,
} from 'date-fns';

// ── Types ──

interface ColumnDef {
  id: string;
  name: string;
  color: string;
}

// ── Date bucket helpers ──

function getDoDateColumns(): ColumnDef[] {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);

  // Find end of work week (Thursday)
  let endOfWorkWeek: Date;
  const dow = today.getDay(); // 0=Sun..6=Sat
  if (dow <= 4) {
    // Sun-Thu: this Thursday
    endOfWorkWeek = isThursday(today) ? today : nextThursday(today);
  } else {
    // Fri/Sat: next Thursday
    endOfWorkWeek = nextThursday(today);
  }

  const cols: ColumnDef[] = [
    { id: 'late', name: 'Late', color: '#ef4444' },
    { id: 'today', name: 'Today', color: '#f59e0b' },
    { id: 'tomorrow', name: 'Tomorrow', color: '#3b82f6' },
  ];

  // Add remaining workweek days (day after tomorrow through end of work week)
  let d = addDays(tomorrow, 1);
  while (!isAfter(d, endOfWorkWeek)) {
    const dayStr = format(d, 'yyyy-MM-dd');
    cols.push({
      id: `day-${dayStr}`,
      name: format(d, 'EEE, MMM d'),
      color: '#8b5cf6',
    });
    d = addDays(d, 1);
  }

  cols.push(
    { id: 'next-week', name: 'Next Week', color: '#06b6d4' },
    { id: 'future', name: 'Future', color: '#6b7280' },
    { id: 'no-date', name: 'No Date', color: '#404040' },
  );

  return cols;
}

function getDoDateBucket(doDate: string | null): string {
  if (!doDate) return 'no-date';
  const today = startOfDay(new Date());
  const d = startOfDay(new Date(doDate + 'T00:00:00'));

  if (isBefore(d, today)) return 'late';
  if (isSameDay(d, today)) return 'today';
  if (isSameDay(d, addDays(today, 1))) return 'tomorrow';

  // End of work week (Thursday)
  const dow = today.getDay();
  let endOfWorkWeek: Date;
  if (dow <= 4) {
    endOfWorkWeek = isThursday(today) ? today : nextThursday(today);
  } else {
    endOfWorkWeek = nextThursday(today);
  }

  if (!isAfter(d, endOfWorkWeek)) {
    return `day-${format(d, 'yyyy-MM-dd')}`;
  }

  // Next week = next Sunday through next Thursday
  const nextWeekStart = nextSunday(endOfWorkWeek);
  const nextWeekEnd = nextThursday(nextWeekStart);
  if (!isBefore(d, nextWeekStart) && !isAfter(d, nextWeekEnd)) {
    return 'next-week';
  }

  return 'future';
}

// ── Kanban Card ──

function KanbanCard({ task, overlay }: { task: Task; overlay?: boolean }) {
  const { openTaskDetail } = useUIStore();
  const { data: sprints = [] } = useSprints();
  const { data: statuses = [] } = useStatuses();
  const subtasksDone = task.subtasks.filter((s) => s.is_completed).length;
  const subtasksTotal = task.subtasks.length;
  const sprint = task.sprint_id ? sprints.find(s => s.id === task.sprint_id) : null;
  const isDone = statuses.find(s => s.id === task.status_id)?.name === 'Done';

  return (
    <TaskContextMenu task={task}>
      <div
        className={cn(
          'bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing transition-shadow group',
          overlay ? 'shadow-xl ring-2 ring-primary/30 rotate-[2deg]' : 'hover:border-primary/30 hover:shadow-md',
          isDone && 'opacity-50',
        )}
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('[data-drag-handle]')) {
            openTaskDetail(task.id);
          }
        }}
      >
        {task.color_override && (
          <div className="h-1 -mx-3 -mt-3 mb-2 rounded-t-lg" style={{ backgroundColor: task.color_override }} />
        )}

        <p className={cn('text-base font-medium text-foreground leading-snug mb-2 line-clamp-2', isDone && 'line-through text-muted-foreground')}>
          {task.title}
        </p>

        {/* Labels */}
        {task.labels.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-2">
            {task.labels.map((l) => (
              <LabelPill key={l.id} label={l} size="sm" />
            ))}
          </div>
        )}

        {/* Sprint badge */}
        {sprint && (
          <div className="mb-2">
            <span className="text-xs px-1.5 py-0.5 rounded-sm bg-primary/15 text-primary font-medium">
              {sprint.name}
            </span>
          </div>
        )}

        {/* Bottom row */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {task.do_date && (
            <span className="text-[13px]">
              {new Date(task.do_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {task.effort_estimate != null && (
            <span className="text-[13px]">{task.effort_estimate}d</span>
          )}
          {subtasksTotal > 0 && (
            <span className="flex items-center gap-0.5 text-[13px]">
              <CheckSquare className="h-4 w-4" />
              {subtasksDone}/{subtasksTotal}
            </span>
          )}
          {task.details && (
            <MessageSquare className="h-3.5 w-3.5 opacity-50" />
          )}
          {task.requires_other === 1 && (
            <span title={task.requires_other_note || 'Requires other'} className="cursor-help">🪢</span>
          )}
          {task.is_quick === 1 && (
            <span title="Quick task">⚡️</span>
          )}
          {task.is_priority === 1 && (
            <span title="Priority">❗️</span>
          )}
          {task.recurrence_rule && (
            <span title={`Recurring: ${task.recurrence_rule}`}>🔁</span>
          )}
          <span className="ml-auto" />
          <TaskQuickActions taskId={task.id} size="xs" />
        </div>
      </div>
    </TaskContextMenu>
  );
}

// ── Sortable Card Wrapper ──

function SortableCard({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `task-${task.id}`,
    data: { type: 'task', task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanCard task={task} />
    </div>
  );
}

// ── Generic Column ──

function KanbanColumn({
  column,
  tasks,
  onQuickAdd,
  templates,
  templatePickerOpen,
  onToggleTemplatePicker,
  onTemplateCreate,
  showQuickAdd,
  quickAddInput,
  onMoveAllToToday,
}: {
  column: ColumnDef;
  tasks: Task[];
  onQuickAdd?: (colId: string) => void;
  templates: { id: number; name: string }[];
  templatePickerOpen: boolean;
  onToggleTemplatePicker: (colId: string) => void;
  onTemplateCreate: (templateId: number, colId: string) => void;
  showQuickAdd: boolean;
  quickAddInput?: React.ReactNode;
  onMoveAllToToday?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
    data: { type: 'column', columnId: column.id },
  });

  const sortableIds = useMemo(() => tasks.map((t) => `task-${t.id}`), [tasks]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col min-w-[280px] max-w-[320px] w-[280px] flex-shrink-0 h-full rounded-lg transition-colors',
        isOver ? 'bg-primary/10 ring-2 ring-primary/30 ring-inset' : '',
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2 mb-2 flex-shrink-0">
        <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: column.color }} />
        <span className="text-sm font-medium text-foreground truncate">{column.name}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{tasks.length}</span>
        {onMoveAllToToday && tasks.length > 0 && (
          <button
            onClick={onMoveAllToToday}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Move all to Today"
          >
            <ArrowRightToLine className="h-3.5 w-3.5" />
          </button>
        )}
        {showQuickAdd && onQuickAdd && (
          <button
            onClick={() => onQuickAdd(column.id)}
            className="ml-auto p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title={`Add task to ${column.name}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
        {showQuickAdd && templates.length > 0 && (
          <div className="relative">
            <button
              onClick={() => onToggleTemplatePicker(column.id)}
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="New from template"
            >
              <FileText className="h-3.5 w-3.5" />
            </button>
            {templatePickerOpen && (
              <div className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[180px] animate-in fade-in-0 zoom-in-95">
                <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  New from Template
                </div>
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => onTemplateCreate(t.id, column.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors text-left"
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cards container — scrolls independently */}
      <div
        className={cn(
          'flex-1 flex flex-col gap-2 px-1.5 py-2 rounded-lg min-h-0 overflow-y-auto transition-colors',
          'bg-secondary/20'
        )}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {quickAddInput}
          {tasks.map((task) => (
            <SortableCard key={task.id} task={task} />
          ))}
        </SortableContext>
        {tasks.length === 0 && !isOver && (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground/30">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Kanban Board ──

export function KanbanBoard({ statusFilter }: { statusFilter?: (status: Status) => boolean }) {
  const { statusId, sprintId, labelId, searchText, statusPhase, sortField, sortDir } = useFilterStore();
  const { openTaskDetail } = useUIStore();
  const { data: allTasks = [], isLoading } = useTasks({
    is_archived: 0,
    status_id: statusId,
    sprint_id: sprintId,
    label_id: labelId,
    search: searchText || undefined,
    status_phase: statusPhase,
  });
  const { data: statuses = [] } = useStatuses();
  const { data: labels = [] } = useLabels();
  const updateTask = useUpdateTask();
  const createTask = useCreateTask();
  const { data: templates = [] } = useTemplates();
  const createFromTemplate = useCreateTaskFromTemplate();
  const reorderKanban = useReorderKanban();
  const addToast = useConnectionStore((s) => s.addToast);

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [templatePickerCol, setTemplatePickerCol] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const { kanbanGroupBy: groupBy, setKanbanGroupBy: setGroupBy, kanbanHideCompleted: hideCompleted, setKanbanHideCompleted: setHideCompleted, setStatusPhase } = useFilterStore();
  const hidePlanning = statusPhase === 'execution';

  // Find the "Done" status id for hiding completed tasks
  const doneStatusId = useMemo(() => statuses.find(s => s.name === 'Done')?.id, [statuses]);

  // Filter tasks (hide completed if toggled)
  const filteredTasks = useMemo(() => {
    if (!hideCompleted || !doneStatusId) return allTasks;
    return allTasks.filter(t => t.status_id !== doneStatusId);
  }, [allTasks, hideCompleted, doneStatusId]);

  // Build columns based on groupBy mode
  const columns: ColumnDef[] = useMemo(() => {
    if (groupBy === 'status') {
      let filtered = statusFilter ? statuses.filter(statusFilter) : statuses;
      if (statusPhase) {
        filtered = filtered.filter(s => s.phase === statusPhase || s.phase === 'any');
      }
      if (hideCompleted) {
        filtered = filtered.filter(s => s.name !== 'Done');
      }
      return filtered.map(s => ({ id: String(s.id), name: s.name, color: s.color }));
    }
    if (groupBy === 'label') {
      return labels.map(l => ({ id: String(l.id), name: l.name, color: l.color }));
    }
    // do_date
    return getDoDateColumns();
  }, [groupBy, statuses, labels, statusFilter, statusPhase, hideCompleted]);

  // Group tasks into columns
  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>();
    columns.forEach(c => map.set(c.id, []));

    filteredTasks.forEach(t => {
      if (groupBy === 'status') {
        const key = String(t.status_id);
        const arr = map.get(key);
        if (arr) arr.push(t);
      } else if (groupBy === 'label') {
        if (t.labels.length === 0) return; // unlabeled tasks won't appear
        t.labels.forEach(l => {
          const arr = map.get(String(l.id));
          if (arr) arr.push(t);
        });
      } else {
        // do_date
        const bucket = getDoDateBucket(t.do_date);
        const arr = map.get(bucket);
        if (arr) arr.push(t);
      }
    });

    // Sort within each group, respecting kanban_order overrides and priority
    for (const [key, tasks] of map) {
      const sorted = sortTasks(tasks, sortField, sortDir);
      // Merge: tasks with kanban_order use that order, others keep sort order
      const withOrder = sorted.filter(t => t.kanban_order != null).sort((a, b) => a.kanban_order! - b.kanban_order!);
      const withoutOrder = sorted.filter(t => t.kanban_order == null);
      const merged = [...withOrder, ...withoutOrder];
      // Priority tasks always float to top, preserving relative order among themselves
      const priority = merged.filter(t => t.is_priority);
      const nonPriority = merged.filter(t => !t.is_priority);
      map.set(key, [...priority, ...nonPriority]);
    }
    return map;
  }, [filteredTasks, columns, groupBy, sortField, sortDir]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task | undefined;
    if (task) setActiveTask(task);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = event;
      if (!over) return;

      const taskData = active.data.current?.task as Task | undefined;
      if (!taskData) return;

      // Determine source column
      let sourceColId: string | null = null;
      if (groupBy === 'status') sourceColId = String(taskData.status_id);
      else if (groupBy === 'label') sourceColId = taskData.labels[0] ? String(taskData.labels[0].id) : null;
      else sourceColId = getDoDateBucket(taskData.do_date);

      // Determine target column
      let targetColId: string | null = null;
      if (over.data.current?.type === 'column') {
        targetColId = over.data.current.columnId;
      } else if (over.data.current?.type === 'task') {
        const overTask = over.data.current.task as Task;
        if (groupBy === 'status') targetColId = String(overTask.status_id);
        else if (groupBy === 'label') targetColId = overTask.labels[0] ? String(overTask.labels[0].id) : null;
        else targetColId = getDoDateBucket(overTask.do_date);
      }

      if (!targetColId) return;

      // Helper: compute and persist new order for a column's tasks
      const persistColumnOrder = (colId: string, movedTaskId: number, overTaskId?: number) => {
        const colTasks = tasksByColumn.get(colId) ?? [];
        const ids = colTasks.map(t => t.id);
        const oldIdx = ids.indexOf(movedTaskId);
        if (oldIdx === -1) {
          // Task moved into this column — insert at overTask position or end
          const insertIdx = overTaskId ? ids.indexOf(overTaskId) : ids.length;
          ids.splice(insertIdx === -1 ? ids.length : insertIdx, 0, movedTaskId);
        } else if (overTaskId) {
          const newIdx = ids.indexOf(overTaskId);
          if (newIdx !== -1 && oldIdx !== newIdx) {
            const reordered = arrayMove(ids, oldIdx, newIdx);
            reorderKanban.mutate(reordered);
            return;
          }
        }
        reorderKanban.mutate(ids);
      };

      const overTaskId = over.data.current?.type === 'task' ? (over.data.current.task as Task).id : undefined;
      const sameColumn = sourceColId === targetColId;

      if (sameColumn) {
        // Reorder within same column
        if (overTaskId && overTaskId !== taskData.id) {
          persistColumnOrder(targetColId, taskData.id, overTaskId);
        }
      } else {
        // Move to different column — update the column property first
        if (groupBy === 'status') {
          const targetStatusId = Number(targetColId);
          const oldStatusId = taskData.status_id;
          const statusName = statuses.find(s => s.id === targetStatusId)?.name || 'status';
          updateTask.mutate({ id: taskData.id, data: { status_id: targetStatusId } }, {
            onSuccess: () => {
              // After column property is updated, persist the order in the target column
              const targetTasks = tasksByColumn.get(targetColId!) ?? [];
              const ids = targetTasks.map(t => t.id);
              if (!ids.includes(taskData.id)) {
                const insertIdx = overTaskId ? ids.indexOf(overTaskId) : 0;
                ids.splice(insertIdx === -1 ? 0 : insertIdx, 0, taskData.id);
              }
              reorderKanban.mutate(ids);
              addToast(`Moved "${taskData.title}" to ${statusName}`, 'success', () => {
                updateTask.mutate({ id: taskData.id, data: { status_id: oldStatusId } });
              });
            },
          });
        } else if (groupBy === 'label') {
          const targetLabelId = Number(targetColId);
          const hasLabel = taskData.labels.some(l => l.id === targetLabelId);
          if (!hasLabel) {
            const newLabelIds = [...taskData.labels.map(l => l.id), targetLabelId];
            updateTask.mutate({ id: taskData.id, data: { label_ids: newLabelIds } });
          }
        } else {
          const newDate = bucketToDate(targetColId);
          if (newDate !== taskData.do_date) {
            updateTask.mutate({ id: taskData.id, data: { do_date: newDate } }, {
              onSuccess: () => {
                const targetTasks = tasksByColumn.get(targetColId!) ?? [];
                const ids = targetTasks.map(t => t.id);
                if (!ids.includes(taskData.id)) {
                  const insertIdx = overTaskId ? ids.indexOf(overTaskId) : 0;
                  ids.splice(insertIdx === -1 ? 0 : insertIdx, 0, taskData.id);
                }
                reorderKanban.mutate(ids);
              },
            });
          }
        }
      }
    },
    [updateTask, statuses, addToast, groupBy, tasksByColumn, reorderKanban]
  );

  const handleDragOver = useCallback((_event: DragOverEvent) => {}, []);

  const handleQuickAdd = useCallback((colId: string) => {
    setAddingToColumn(colId);
    setTemplatePickerCol(null);
    setNewTitle('');
  }, []);

  const handleQuickAddSubmit = useCallback(() => {
    if (!newTitle.trim() || addingToColumn === null) return;
    const data: Record<string, unknown> = { title: newTitle.trim() };
    if (groupBy === 'status') {
      data.status_id = Number(addingToColumn);
    } else if (groupBy === 'do_date') {
      const d = bucketToDate(addingToColumn);
      if (d) data.do_date = d;
    }
    createTask.mutate(data as { title: string; status_id?: number });
    setNewTitle('');
    setAddingToColumn(null);
  }, [newTitle, addingToColumn, createTask, groupBy]);

  const handleTemplateCreate = useCallback((templateId: number, colId: string) => {
    const data: { status_id?: number } = {};
    if (groupBy === 'status') data.status_id = Number(colId);
    createFromTemplate.mutate({ templateId, data }, {
      onSuccess: (task) => { openTaskDetail(task.id); },
    });
    setTemplatePickerCol(null);
  }, [createFromTemplate, openTaskDetail, groupBy]);

  return (
    <div className="flex flex-col h-full">
      <FilterBar />
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Loading...
        </div>
      ) : (
        <>

      {/* Kanban toolbar */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-border text-xs">
        <span className="text-muted-foreground">Group by:</span>
        <div className="flex items-center bg-secondary rounded-md p-0.5">
          {(['status', 'label', 'do_date'] as KanbanGroupBy[]).map(mode => (
            <button
              key={mode}
              onClick={() => setGroupBy(mode)}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                groupBy === mode
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {mode === 'status' ? 'Status' : mode === 'label' ? 'Label' : 'Do Date'}
            </button>
          ))}
        </div>

        <button
          onClick={() => setHideCompleted(!hideCompleted)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors',
            hideCompleted
              ? 'bg-primary/15 border-primary/30 text-primary'
              : 'bg-secondary border-input text-muted-foreground hover:text-foreground'
          )}
        >
          {hideCompleted ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {hideCompleted ? 'Completed hidden' : 'Hide completed'}
        </button>

        <button
          onClick={() => setStatusPhase(hidePlanning ? undefined : 'execution')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors',
            hidePlanning
              ? 'bg-primary/15 border-primary/30 text-primary'
              : 'bg-secondary border-input text-muted-foreground hover:text-foreground'
          )}
          title={hidePlanning ? 'Showing execution tasks only' : 'Click to hide planning tasks'}
        >
          {hidePlanning ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {hidePlanning ? 'Planning hidden' : 'Hide planning'}
        </button>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
        >
          <div className="flex gap-3 p-4 h-full min-w-max">
            {columns.map((col) => (
              <div key={col.id} className="flex flex-col min-w-[280px] max-w-[320px] w-[280px] h-full">
                <KanbanColumn
                  column={col}
                  tasks={tasksByColumn.get(col.id) ?? []}
                  onQuickAdd={groupBy !== 'label' ? handleQuickAdd : undefined}
                  showQuickAdd={groupBy !== 'label'}
                  templates={templates}
                  templatePickerOpen={templatePickerCol === col.id}
                  onToggleTemplatePicker={(id) => setTemplatePickerCol(prev => prev === id ? null : id)}
                  onTemplateCreate={handleTemplateCreate}
                  onMoveAllToToday={col.id === 'late' ? () => {
                    const lateTasks = tasksByColumn.get('late') ?? [];
                    const todayStr = format(new Date(), 'yyyy-MM-dd');
                    lateTasks.forEach(t => updateTask.mutate({ id: t.id, data: { do_date: todayStr } }));
                  } : undefined}
                  quickAddInput={addingToColumn === col.id ? (
                    <div className="px-1.5 mb-1 flex-shrink-0">
                      <input
                        autoFocus
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleQuickAddSubmit();
                          if (e.key === 'Escape') setAddingToColumn(null);
                        }}
                        onBlur={() => { if (!newTitle.trim()) setAddingToColumn(null); }}
                        placeholder="Task title…"
                        className="w-full h-8 px-3 bg-card border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  ) : null}
                />
              </div>
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeTask ? (
              <div className="w-[280px]">
                <KanbanCard task={activeTask} overlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
      </>
      )}
    </div>
  );
}

// Helper: convert a do_date bucket id back to a date string for assignment
function bucketToDate(bucket: string): string | null {
  const today = startOfDay(new Date());
  switch (bucket) {
    case 'late': return format(addDays(today, -1), 'yyyy-MM-dd');
    case 'today': return format(today, 'yyyy-MM-dd');
    case 'tomorrow': return format(addDays(today, 1), 'yyyy-MM-dd');
    case 'next-week': return format(nextSunday(today), 'yyyy-MM-dd');
    case 'future': return format(addDays(today, 14), 'yyyy-MM-dd');
    case 'no-date': return null;
    default:
      if (bucket.startsWith('day-')) return bucket.slice(4);
      return null;
  }
}
