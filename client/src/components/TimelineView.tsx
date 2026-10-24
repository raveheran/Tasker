import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { addDays, differenceInDays, format, endOfWeek, endOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, isToday } from 'date-fns';
import { ZoomIn, ZoomOut, EyeOff, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTasks, useStatuses, useUpdateTask, useSprints, useSettings } from '@/hooks';
import { useUIStore, useFilterStore } from '@/store';
import type { Task, Status } from '@/types';
import { FilterBar } from './FilterBar';
import { sortTasks } from '@/lib/sortTasks';

type ZoomLevel = 'day' | 'week' | 'month';

const ZOOM_CONFIGS: Record<ZoomLevel, { colWidth: number; label: string }> = {
  day: { colWidth: 36, label: 'Day' },
  week: { colWidth: 22, label: 'Week' },
  month: { colWidth: 8, label: 'Month' },
};

const ROW_HEIGHT = 40;
const LABEL_WIDTH = 240;

function getTaskDates(task: Task): { start: Date; end: Date } | null {
  if (task.start_date && task.end_date) {
    return { start: new Date(task.start_date), end: new Date(task.end_date) };
  }
  // Fallback: use do_date as both start and end (display only)
  if (task.do_date) {
    const d = new Date(task.do_date);
    return { start: d, end: d };
  }
  return null;
}

// ── Gantt Bar ──

function GanttBar({
  task,
  startOffset,
  widthPx,
  statusColor,
  onOpenDetail,
  onDragMove,
  onDragResize,
  onDragResizeLeft,
  colWidth,
  timelineStart,
}: {
  task: Task;
  startOffset: number;
  widthPx: number;
  statusColor: string;
  onOpenDetail: (id: number) => void;
  onDragMove: (taskId: number, deltaDays: number) => void;
  onDragResize: (taskId: number, deltaDays: number) => void;
  onDragResizeLeft: (taskId: number, deltaDays: number) => void;
  colWidth: number;
  timelineStart: Date;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const didDragRef = useRef(false);
  const [previewDate, setPreviewDate] = useState<{ label: string; x: number } | null>(null);

  // Drag to move
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      didDragRef.current = false;
      const handleMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        if (Math.abs(dx) > 3) didDragRef.current = true;
        if (barRef.current) {
          barRef.current.style.transform = `translateX(${dx}px)`;
        }
        // Show start/end date preview — x is relative to transformed bar, so use center
        const deltaDays = Math.round(dx / colWidth);
        const currentStartDay = Math.round(startOffset / colWidth) + deltaDays;
        const currentEndDay = currentStartDay + Math.round(widthPx / colWidth) - 1;
        const newStart = addDays(timelineStart, currentStartDay);
        const newEnd = addDays(timelineStart, currentEndDay);
        setPreviewDate({ label: `${format(newStart, 'MMM d')} → ${format(newEnd, 'MMM d')}`, x: widthPx / 2 });
      };
      const handleUp = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const deltaDays = Math.round(dx / colWidth);
        if (barRef.current) barRef.current.style.transform = '';
        setPreviewDate(null);
        if (deltaDays !== 0) onDragMove(task.id, deltaDays);
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [task.id, onDragMove, colWidth, startOffset, widthPx, timelineStart],
  );

  // Drag to resize (right edge)
  const handleResizeRightStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const origWidth = widthPx;
      didDragRef.current = false;
      const handleMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        if (Math.abs(dx) > 3) didDragRef.current = true;
        const newWidth = Math.max(colWidth, origWidth + dx);
        if (barRef.current) {
          barRef.current.style.width = `${newWidth}px`;
        }
        const deltaDays = Math.round(dx / colWidth);
        const startDay = Math.round(startOffset / colWidth);
        const origDuration = Math.round(origWidth / colWidth);
        const newEnd = addDays(timelineStart, startDay + origDuration - 1 + deltaDays);
        setPreviewDate({ label: format(newEnd, 'MMM d, yyyy'), x: newWidth });
      };
      const handleUp = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const deltaDays = Math.round(dx / colWidth);
        if (barRef.current) barRef.current.style.width = '';
        setPreviewDate(null);
        if (deltaDays !== 0) onDragResize(task.id, deltaDays);
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [task.id, widthPx, onDragResize, colWidth, startOffset, timelineStart],
  );

  // Drag to resize (left edge)
  const handleResizeLeftStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const origWidth = widthPx;
      const origLeft = startOffset;
      didDragRef.current = false;
      const handleMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        if (Math.abs(dx) > 3) didDragRef.current = true;
        const newWidth = Math.max(colWidth, origWidth - dx);
        const newLeft = origLeft + (origWidth - newWidth);
        if (barRef.current) {
          barRef.current.style.left = `${newLeft}px`;
          barRef.current.style.width = `${newWidth}px`;
        }
        const deltaDays = Math.round(dx / colWidth);
        const newStartDay = Math.round(origLeft / colWidth) + deltaDays;
        const newStart = addDays(timelineStart, newStartDay);
        setPreviewDate({ label: format(newStart, 'MMM d, yyyy'), x: 0 });
      };
      const handleUp = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const deltaDays = Math.round(dx / colWidth);
        if (barRef.current) {
          barRef.current.style.left = `${startOffset}px`;
          barRef.current.style.width = '';
        }
        setPreviewDate(null);
        if (deltaDays !== 0) onDragResizeLeft(task.id, deltaDays);
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [task.id, widthPx, startOffset, onDragResizeLeft, colWidth, timelineStart],
  );

  return (
    <div
      ref={barRef}
      className="absolute top-1"
      style={{ left: startOffset, width: Math.max(widthPx, colWidth), height: 28 }}
    >
      <div
        className="h-full w-full rounded-md cursor-grab active:cursor-grabbing flex items-center px-2 text-xs text-white font-medium select-none group overflow-hidden relative"
        style={{ backgroundColor: statusColor }}
        onMouseDown={handleDragStart}
        onClick={(e) => { e.stopPropagation(); if (!didDragRef.current) onOpenDetail(task.id); }}
        title={task.title}
      >
        <span className="truncate">{task.title}</span>
        {/* Left resize handle */}
        <div
          className="absolute left-0 top-0 w-2 h-full cursor-w-resize opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}
          onMouseDown={handleResizeLeftStart}
        />
        {/* Right resize handle */}
        <div
          className="absolute right-0 top-0 w-2 h-full cursor-e-resize opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}
          onMouseDown={handleResizeRightStart}
        />
      </div>
      {/* Date preview tooltip — outside overflow-hidden bar */}
      {previewDate && (
        <div
          className="absolute -top-7 whitespace-nowrap bg-popover text-popover-foreground text-[10px] px-2 py-0.5 rounded shadow-lg border border-border pointer-events-none z-30"
          style={{ left: previewDate.x, transform: 'translateX(-50%)' }}
        >
          {previewDate.label}
        </div>
      )}
    </div>
  );
}

// ── Main Timeline View ──

export function TimelineView() {
  const { statusId, sprintId, labelId, searchText, statusPhase, sortField, sortDir } = useFilterStore();
  const { openTaskDetail } = useUIStore();
  const updateTask = useUpdateTask();
  const { data: allTasks = [] } = useTasks({
    is_archived: 0,
    status_id: statusId,
    sprint_id: sprintId,
    label_id: labelId,
    search: searchText || undefined,
    status_phase: statusPhase,
  });
  const { data: statuses = [] } = useStatuses();
  const { data: sprints = [] } = useSprints();
  const { data: settings } = useSettings();
  const statusMap = useMemo(() => new Map(statuses.map((s: Status) => [s.id, s])), [statuses]);
  const sprintMap = useMemo(() => new Map(sprints.map(s => [s.id, s.name])), [sprints]);

  const [hideCompleted, setHideCompleted] = useState(true);
  const doneStatusId = useMemo(() => statuses.find(s => s.name === 'Done')?.id, [statuses]);
  const filteredTasks = useMemo(
    () => hideCompleted && doneStatusId ? allTasks.filter(t => t.status_id !== doneStatusId) : allTasks,
    [allTasks, hideCompleted, doneStatusId],
  );

  const defaultEffort = Number(settings?.default_effort_days) || 3;

  // Execution-phase status IDs
  const executionStatusIds = useMemo(() => {
    return new Set(statuses.filter(s => s.phase === 'execution' || s.phase === 'any').map(s => s.id));
  }, [statuses]);

  // Unscheduled execution-phase tasks (no start/end dates AND no do_date)
  const unscheduledTasks = useMemo(() =>
    filteredTasks.filter(t => !(t.start_date && t.end_date) && !t.do_date && executionStatusIds.has(t.status_id)),
    [filteredTasks, executionStatusIds],
  );

  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Only show tasks that have date info (sorted)
  const tasks = useMemo(
    () => sortTasks(filteredTasks.filter((t: Task) => getTaskDates(t) !== null), sortField, sortDir),
    [filteredTasks, sortField, sortDir],
  );
  const tasksWithDates = useMemo(
    () => tasks.map((t: Task) => ({ task: t, dates: getTaskDates(t)! })),
    [tasks],
  );

  // Compute timeline range
  const { timelineStart, timelineEnd, days } = useMemo(() => {
    if (tasksWithDates.length === 0) {
      const now = new Date();
      const s = addDays(now, -7);
      const e = addDays(now, 30);
      return { timelineStart: s, timelineEnd: e, days: eachDayOfInterval({ start: s, end: e }) };
    }
    let earliest = tasksWithDates[0].dates.start;
    let latest = tasksWithDates[0].dates.end;
    for (const { dates } of tasksWithDates) {
      if (dates.start < earliest) earliest = dates.start;
      if (dates.end > latest) latest = dates.end;
    }
    // Add padding
    const s = addDays(earliest, -7);
    const e = addDays(latest, 14);
    return { timelineStart: s, timelineEnd: e, days: eachDayOfInterval({ start: s, end: e }) };
  }, [tasksWithDates]);

  const colWidth = ZOOM_CONFIGS[zoom].colWidth;
  const totalWidth = days.length * colWidth;

  // Scroll to today on mount
  useEffect(() => {
    if (!scrollRef.current) return;
    const todayOffset = differenceInDays(new Date(), timelineStart) * colWidth;
    scrollRef.current.scrollLeft = Math.max(0, todayOffset - 200);
  }, [timelineStart, colWidth]);

  // Header time markers
  const headerMarkers = useMemo(() => {
    if (zoom === 'day') {
      return days.map((d, i) => ({
        label: format(d, 'd'),
        sublabel: i === 0 || d.getDate() === 1 ? format(d, 'MMM yyyy') : '',
        offset: i * colWidth,
        width: colWidth,
        isToday: isToday(d),
      }));
    }
    if (zoom === 'week') {
      const weeks = eachWeekOfInterval({ start: timelineStart, end: timelineEnd });
      return weeks.map((w) => {
        const we = endOfWeek(w);
        const offset = differenceInDays(w, timelineStart) * colWidth;
        const width = (differenceInDays(we, w) + 1) * colWidth;
        return {
          label: `${format(w, 'MMM d')}`,
          sublabel: '',
          offset,
          width,
          isToday: false,
        };
      });
    }
    // month
    const months = eachMonthOfInterval({ start: timelineStart, end: timelineEnd });
    return months.map((m) => {
      const me = endOfMonth(m);
      const offset = Math.max(0, differenceInDays(m, timelineStart)) * colWidth;
      const daysInRange = differenceInDays(me, m) + 1;
      return {
        label: format(m, 'MMM yyyy'),
        sublabel: '',
        offset,
        width: daysInRange * colWidth,
        isToday: false,
      };
    });
  }, [zoom, days, timelineStart, timelineEnd, colWidth]);

  // Sprint bars — sprints with date ranges that overlap the visible timeline
  const sprintBars = useMemo(() => {
    return sprints
      .filter(s => s.start_date && s.end_date)
      .map(s => {
        const sStart = new Date(s.start_date!);
        const sEnd = new Date(s.end_date!);
        // Skip sprints entirely outside the visible range
        if (sEnd < timelineStart || sStart > timelineEnd) return null;
        const dayStart = Math.max(0, differenceInDays(sStart, timelineStart));
        const dayEnd = Math.min(days.length - 1, differenceInDays(sEnd, timelineStart));
        const offset = dayStart * colWidth;
        const width = (dayEnd - dayStart + 1) * colWidth;
        return { id: s.id, name: s.name, offset, width, isActive: !!s.is_active, startDate: s.start_date!, endDate: s.end_date! };
      })
      .filter(Boolean) as { id: number; name: string; offset: number; width: number; isActive: boolean; startDate: string; endDate: string }[];
  }, [sprints, timelineStart, timelineEnd, days.length, colWidth]);

  // Today marker position
  const todayOffset = differenceInDays(new Date(), timelineStart) * colWidth;

  const handleDragMove = useCallback(
    (taskId: number, deltaDays: number) => {
      const item = tasksWithDates.find(x => x.task.id === taskId);
      if (!item) return;
      const newStart = addDays(item.dates.start, deltaDays);
      const newEnd = addDays(item.dates.end, deltaDays);
      updateTask.mutate({
        id: taskId,
        data: {
          start_date: format(newStart, 'yyyy-MM-dd'),
          end_date: format(newEnd, 'yyyy-MM-dd'),
        },
      });
    },
    [tasksWithDates, updateTask],
  );

  const handleDragResize = useCallback(
    (taskId: number, deltaDays: number) => {
      const item = tasksWithDates.find(x => x.task.id === taskId);
      if (!item) return;
      const newEnd = addDays(item.dates.end, deltaDays);
      if (newEnd < item.dates.start) return;
      updateTask.mutate({
        id: taskId,
        data: { end_date: format(newEnd, 'yyyy-MM-dd') },
      });
    },
    [tasksWithDates, updateTask],
  );

  const handleDragResizeLeft = useCallback(
    (taskId: number, deltaDays: number) => {
      const item = tasksWithDates.find(x => x.task.id === taskId);
      if (!item) return;
      const newStart = addDays(item.dates.start, deltaDays);
      if (newStart > item.dates.end) return;
      updateTask.mutate({
        id: taskId,
        data: { start_date: format(newStart, 'yyyy-MM-dd') },
      });
    },
    [tasksWithDates, updateTask],
  );

  const cycleZoom = useCallback(
    (dir: 'in' | 'out') => {
      const levels: ZoomLevel[] = ['month', 'week', 'day'];
      const idx = levels.indexOf(zoom);
      const next = dir === 'in' ? Math.min(idx + 1, 2) : Math.max(idx - 1, 0);
      setZoom(levels[next]);
    },
    [zoom],
  );

  return (
    <div className="flex flex-col h-full">
      <FilterBar />

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border text-sm">
        <span className="text-muted-foreground">Zoom:</span>
        <button onClick={() => cycleZoom('out')} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="text-xs font-medium text-foreground w-12 text-center">{ZOOM_CONFIGS[zoom].label}</span>
        <button onClick={() => cycleZoom('in')} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
          <ZoomIn className="h-4 w-4" />
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setHideCompleted(!hideCompleted)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
              hideCompleted ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
            )}
            title={hideCompleted ? 'Show completed tasks' : 'Hide completed tasks'}
          >
            {hideCompleted ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {hideCompleted ? 'Completed hidden' : 'Showing all'}
          </button>
        </div>
      </div>

      {/* Main area: unscheduled sidebar + gantt */}
      <div className="flex flex-1 overflow-hidden">
        {/* Unscheduled tasks sidebar */}
        {unscheduledTasks.length > 0 && (
          <div className="w-52 flex-shrink-0 border-r border-border flex flex-col bg-card/50">
            <div className="px-3 py-2 border-b border-border">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Unscheduled ({unscheduledTasks.length})
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {unscheduledTasks.map(t => {
                const status = statusMap.get(t.status_id);
                return (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', String(t.id));
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    className="bg-card border border-border rounded-md px-2.5 py-2 cursor-grab active:cursor-grabbing hover:border-primary/30 transition-colors"
                    onClick={() => openTaskDetail(t.id)}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: status?.color || '#6b7280' }} />
                      <span className="text-xs font-medium text-foreground truncate">{t.title}</span>
                    </div>
                    {t.labels.length > 0 && (
                      <div className="flex gap-0.5 flex-wrap">
                        {t.labels.slice(0, 3).map(l => (
                          <span key={l.id} className="text-[9px] px-1 rounded-full" style={{ backgroundColor: `${l.color}25`, color: l.color }}>
                            {l.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Gantt chart area */}
        <div className="flex flex-1 overflow-hidden">
        {/* Left labels column */}
        <div className="flex-shrink-0 border-r border-border overflow-y-auto" style={{ width: LABEL_WIDTH }}>
          {/* header spacer — matches sprint lane (h-6) + date header (h-10) */}
          <div className="border-b border-border bg-card sticky top-0 z-10 flex items-end px-3 text-xs font-medium text-muted-foreground" style={{ height: sprintBars.length > 0 ? 72 : 40 }}>
            Task
          </div>
          {tasksWithDates.map(({ task }) => {
            const status = statusMap.get(task.status_id);
            const sprintName = task.sprint_id ? sprintMap.get(task.sprint_id) : null;
            return (
              <div
                key={task.id}
                className="flex items-center gap-2 px-3 border-b border-border/30 hover:bg-secondary/30 cursor-pointer"
                style={{ height: ROW_HEIGHT }}
                onClick={() => openTaskDetail(task.id)}
              >
                <div
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: status?.color || '#6b7280' }}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate text-foreground block">
                    {task.is_priority ? '❗️ ' : ''}{task.is_quick ? '⚡️ ' : ''}{task.requires_other ? <span title={task.requires_other_note || 'Requires other'} className="cursor-help">🪢 </span> : ''}{task.title}
                  </span>
                  {(task.labels.length > 0 || sprintName) && (
                    <div className="flex gap-0.5 flex-wrap">
                      {task.labels.map(l => (
                        <span key={l.id} className="inline-flex items-center gap-0.5 text-[8px] px-1 rounded-full" style={{ backgroundColor: `${l.color}25`, color: l.color }}>
                          <span className="h-1 w-1 rounded-full" style={{ backgroundColor: l.color }} />
                          {l.name}
                        </span>
                      ))}
                      {sprintName && (
                        <span className="text-[8px] px-1 rounded bg-primary/15 text-primary">{sprintName}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right scrollable chart */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto"
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
          onDrop={(e) => {
            e.preventDefault();
            const taskIdStr = e.dataTransfer.getData('text/plain');
            if (!taskIdStr) return;
            const taskId = Number(taskIdStr);
            // Calculate which day was dropped on
            const rect = scrollRef.current!.getBoundingClientRect();
            const x = e.clientX - rect.left + scrollRef.current!.scrollLeft;
            const dayIndex = Math.floor(x / colWidth);
            if (dayIndex >= 0 && dayIndex < days.length) {
              const startDate = format(days[dayIndex], 'yyyy-MM-dd');
              const endDate = format(addDays(days[dayIndex], defaultEffort), 'yyyy-MM-dd');
              updateTask.mutate({ id: taskId, data: { start_date: startDate, end_date: endDate } });
            }
          }}
        >
          <div style={{ width: totalWidth, minHeight: '100%' }} className="relative">
            {/* Time header: sprint lane + date markers */}
            <div className="border-b border-border bg-card sticky top-0 z-10" style={{ height: sprintBars.length > 0 ? 72 : 40 }}>
              {/* Sprint span lane */}
              {sprintBars.length > 0 && (
                <div className="relative h-8 border-b border-border/30">
                  {sprintBars.map(sb => (
                    <div
                      key={sb.id}
                      className={cn(
                        'absolute top-1 h-6 rounded text-[10px] font-medium flex items-center justify-center truncate px-2 border',
                        sb.isActive
                          ? 'bg-primary/20 text-primary border-primary/40'
                          : 'bg-muted/60 text-muted-foreground border-border',
                      )}
                      style={{ left: sb.offset, width: sb.width }}
                      title={`${sb.name} (${format(new Date(sb.startDate), 'MMM d')} – ${format(new Date(sb.endDate), 'MMM d, yyyy')})`}
                    >
                      {sb.name}
                    </div>
                  ))}
                </div>
              )}
              {/* Date markers */}
              <div className="h-10 flex items-end">
                {headerMarkers.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex-shrink-0 border-r border-border/30 text-center flex flex-col justify-end pb-1',
                      m.isToday && 'bg-primary/10',
                    )}
                    style={{ width: m.width, marginLeft: i === 0 ? m.offset : 0 }}
                  >
                    {m.sublabel && (
                      <span className="text-[9px] text-muted-foreground/60">{m.sublabel}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground font-medium">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Grid rows + bars */}
            {tasksWithDates.map(({ task, dates }) => {
              const dayStart = differenceInDays(dates.start, timelineStart);
              const duration = differenceInDays(dates.end, dates.start) + 1;
              const startOffset = dayStart * colWidth;
              const widthPx = duration * colWidth;
              const status = statusMap.get(task.status_id);

              return (
                <div
                  key={task.id}
                  className="relative border-b border-border/20"
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Day grid lines — only render for day zoom */}
                  {zoom === 'day' &&
                    days.map((d, di) => (
                      <div
                        key={di}
                        className={cn(
                          'absolute top-0 h-full border-r border-border/10',
                          isToday(d) && 'bg-primary/5',
                        )}
                        style={{ left: di * colWidth, width: colWidth }}
                      />
                    ))}
                  <GanttBar
                    task={task}
                    startOffset={startOffset}
                    widthPx={widthPx}
                    statusColor={status?.color || '#6b7280'}
                    onOpenDetail={openTaskDetail}
                    onDragMove={handleDragMove}
                    onDragResize={handleDragResize}
                    onDragResizeLeft={handleDragResizeLeft}
                    colWidth={colWidth}
                    timelineStart={timelineStart}
                  />
                </div>
              );
            })}

            {/* Today indicator line */}
            {todayOffset >= 0 && todayOffset <= totalWidth && (
              <div
                className="absolute top-0 bottom-0 w-px bg-red-500/60 z-20 pointer-events-none"
                style={{ left: todayOffset }}
              >
                <div className="absolute -top-0 -left-1 w-2 h-2 bg-red-500 rounded-full" />
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Empty state */}
      {tasks.length === 0 && unscheduledTasks.length === 0 && (
        <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
          No tasks with dates. Set start/end dates on tasks to see them here.
        </div>
      )}
    </div>
  );
}
