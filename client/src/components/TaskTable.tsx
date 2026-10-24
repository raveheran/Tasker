import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTasks, useStatuses, useSprints, useUpdateTask, useDeleteTask } from '@/hooks';
import { useUIStore, useFilterStore } from '@/store';
import type { Task } from '@/types';
import { FilterBar } from './FilterBar';
import { TaskContextMenu } from './TaskContextMenu';
import { TaskQuickActions } from './TaskQuickActions';
import { LabelPill } from './LabelPill';

function InlineEdit({
  value,
  onSave,
  type = 'text',
}: {
  value: string;
  onSave: (v: string) => void;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <span
        onDoubleClick={() => { setDraft(value); setEditing(true); }}
        className="cursor-text hover:bg-secondary/50 px-1 py-0.5 rounded min-w-[2rem] inline-block"
      >
        {value || <span className="text-muted-foreground">—</span>}
      </span>
    );
  }

  return (
    <input
      autoFocus
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { onSave(draft); setEditing(false); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { onSave(draft); setEditing(false); }
        if (e.key === 'Escape') setEditing(false);
      }}
      className="h-7 px-1 bg-secondary text-foreground text-sm rounded border border-input focus:outline-none focus:ring-1 focus:ring-ring w-full"
    />
  );
}

export function TaskTable({ statusPhaseOverride }: { statusPhaseOverride?: string }) {
  const { statusId, sprintId, labelId, searchText, statusPhase } = useFilterStore();
  const { openTaskDetail } = useUIStore();
  const effectivePhase = statusPhaseOverride ?? statusPhase;
  const { data: tasks = [], isLoading } = useTasks({
    is_archived: 0,
    status_id: statusId,
    sprint_id: sprintId,
    label_id: labelId,
    search: searchText || undefined,
    status_phase: effectivePhase,
  });
  const { data: statuses = [] } = useStatuses();
  const { data: sprints = [] } = useSprints();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Clear selections when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusId, sprintId, labelId, searchText, effectivePhase]);

  const statusMap = useMemo(
    () => new Map(statuses.map((s) => [s.id, s])),
    [statuses]
  );
  const sprintMap = useMemo(
    () => new Map(sprints.map((s) => [s.id, s])),
    [sprints]
  );

  const handleFieldSave = useCallback(
    (taskId: number, field: string, value: string | number | null) => {
      updateTask.mutate({ id: taskId, data: { [field]: value || null } });
    },
    [updateTask]
  );

  const columns = useMemo<ColumnDef<Task>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <input
            type="checkbox"
            checked={tasks.length > 0 && selectedIds.size === tasks.length}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedIds(new Set(tasks.map(t => t.id)));
              } else {
                setSelectedIds(new Set());
              }
            }}
            className="rounded border-input"
          />
        ),
        size: 40,
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedIds.has(row.original.id)}
            onChange={(e) => {
              const next = new Set(selectedIds);
              if (e.target.checked) next.add(row.original.id);
              else next.delete(row.original.id);
              setSelectedIds(next);
            }}
            className="rounded border-input"
          />
        ),
      },
      {
        accessorKey: 'title',
        header: 'Title',
        size: 300,
        cell: ({ row }) => (
          <div className="flex items-center gap-2 group">
            <button
              onClick={() => openTaskDetail(row.original.id)}
              className="text-left hover:text-primary transition-colors font-medium truncate"
            >
              {row.original.is_priority ? '❗️ ' : ''}
              {row.original.is_quick ? '⚡️ ' : ''}
              {row.original.requires_other ? <span title={row.original.requires_other_note || 'Requires other'} className="cursor-help">🪢 </span> : ''}
              {row.original.title}
            </button>
            <TaskQuickActions taskId={row.original.id} size="xs" />
          </div>
        ),
      },
      {
        accessorKey: 'status_id',
        header: 'Status',
        size: 140,
        cell: ({ row }) => {
          const task = row.original;
          return (
            <select
              value={task.status_id}
              onChange={(e) => handleFieldSave(task.id, 'status_id', Number(e.target.value))}
              className="h-7 px-1 bg-transparent text-sm rounded border-none focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              style={{ color: statusMap.get(task.status_id)?.color }}
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.id} style={{ color: s.color }}>{s.name}</option>
              ))}
            </select>
          );
        },
        sortingFn: (a, b) => {
          const sa = statusMap.get(a.original.status_id)?.sort_order ?? 0;
          const sb = statusMap.get(b.original.status_id)?.sort_order ?? 0;
          return sa - sb;
        },
      },
      {
        accessorKey: 'sprint_id',
        header: 'Sprint',
        size: 130,
        cell: ({ row }) => {
          const task = row.original;
          return (
            <select
              value={task.sprint_id ?? ''}
              onChange={(e) => handleFieldSave(task.id, 'sprint_id', e.target.value ? Number(e.target.value) : null)}
              className="h-7 px-1 bg-transparent text-sm rounded border-none focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer text-muted-foreground"
            >
              <option value="">—</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          );
        },
      },
      {
        accessorKey: 'do_date',
        header: 'Do Date',
        size: 120,
        cell: ({ row }) => (
          <InlineEdit
            type="date"
            value={row.original.do_date ?? ''}
            onSave={(v) => handleFieldSave(row.original.id, 'do_date', v)}
          />
        ),
      },
      {
        accessorKey: 'effort_estimate',
        header: 'Effort',
        size: 80,
        cell: ({ row }) => (
          <InlineEdit
            type="number"
            value={row.original.effort_estimate?.toString() ?? ''}
            onSave={(v) => handleFieldSave(row.original.id, 'effort_estimate', v ? Number(v) : null)}
          />
        ),
      },
      {
        id: 'labels',
        header: 'Labels',
        size: 150,
        cell: ({ row }) => (
          <div className="flex gap-1 flex-wrap">
            {row.original.labels.map((l) => (
              <LabelPill key={l.id} label={l} size="xs" />
            ))}
          </div>
        ),
      },
      {
        id: 'subtasks',
        header: 'Subtasks',
        size: 90,
        cell: ({ row }) => {
          const subs = row.original.subtasks;
          if (!subs.length) return <span className="text-muted-foreground text-xs">—</span>;
          const done = subs.filter((s) => s.is_completed).length;
          return (
            <span className="text-xs text-muted-foreground">
              {done}/{subs.length}
            </span>
          );
        },
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        size: 100,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {format(new Date(row.original.created_at), 'MMM d')}
          </span>
        ),
      },
    ],
    [statuses, sprints, statusMap, sprintMap, handleFieldSave, openTaskDetail, selectedIds, tasks]
  );

  const table = useReactTable({
    data: tasks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: 'onChange',
  });

  return (
    <div className="flex flex-col h-full">
      <FilterBar />
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Loading tasks...
        </div>
      ) : (
        <>
      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 border-b border-primary/20 text-sm">
          <span className="text-primary font-medium">{selectedIds.size} selected</span>
          <select
            defaultValue=""
            onChange={(e) => {
              const statusId = Number(e.target.value);
              if (!statusId) return;
              selectedIds.forEach(id => updateTask.mutate({ id, data: { status_id: statusId } }));
              setSelectedIds(new Set());
            }}
            className="h-7 px-2 bg-secondary text-foreground text-xs rounded border border-input"
          >
            <option value="">Move to status…</option>
            {statuses.map(s => <option key={s.id} value={s.id} style={{ color: s.color }}>{s.name}</option>)}
          </select>
          <select
            defaultValue=""
            onChange={(e) => {
              const sprintId = e.target.value ? Number(e.target.value) : null;
              selectedIds.forEach(id => updateTask.mutate({ id, data: { sprint_id: sprintId } }));
              setSelectedIds(new Set());
            }}
            className="h-7 px-2 bg-secondary text-foreground text-xs rounded border border-input"
          >
            <option value="">Set sprint…</option>
            <option value="">None</option>
            {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button
            onClick={() => {
              selectedIds.forEach(id => updateTask.mutate({ id, data: { is_archived: 1 } }));
              setSelectedIds(new Set());
            }}
            className="h-7 px-3 text-xs bg-secondary text-foreground rounded border border-input hover:bg-secondary/80"
          >
            Archive
          </button>
          <button
            onClick={() => {
              if (!confirm(`Delete ${selectedIds.size} tasks?`)) return;
              selectedIds.forEach(id => deleteTask.mutate(id));
              setSelectedIds(new Set());
            }}
            className="h-7 px-3 text-xs bg-destructive/10 text-destructive rounded border border-destructive/20 hover:bg-destructive/20"
          >
            Delete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
          <thead className="sticky top-0 bg-card z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-left font-medium text-muted-foreground px-3 py-2 relative select-none"
                    style={{ width: header.getSize() }}
                  >
                    <button
                      onClick={header.column.getToggleSortingHandler()}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : header.column.getIsSorted() === 'desc' ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </button>
                    {/* Column resize handle */}
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={cn(
                        'absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none',
                        header.column.getIsResizing() ? 'bg-primary' : 'hover:bg-border'
                      )}
                    />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <TaskContextMenu key={row.id} task={row.original}>
                {(onContextMenu) => (
                  <tr
                    className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                    onContextMenu={onContextMenu}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-3 py-2"
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                )}
              </TaskContextMenu>
            ))}
          </tbody>
        </table>
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No tasks found. Click + to create one.
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
