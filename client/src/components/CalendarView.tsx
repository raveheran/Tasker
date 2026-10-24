import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import type { EventInput, EventClickArg, EventDropArg, EventContentArg } from '@fullcalendar/core';
import { addDays, format } from 'date-fns';
import { EyeOff, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTasks, useStatuses, useUpdateTask, useSprints, useSettings } from '@/hooks';
import { useUIStore, useFilterStore } from '@/store';
import type { Task } from '@/types';

export function CalendarView() {
  const { statusId, sprintId, labelId, searchText, statusPhase } = useFilterStore();
  const { openTaskDetail } = useUIStore();
  const updateTask = useUpdateTask();
  const { data: sprints = [] } = useSprints();
  const { data: statuses = [] } = useStatuses();
  const { data: settings } = useSettings();
  const sidebarRef = useRef<HTMLDivElement>(null);

  const defaultEffort = Number(settings?.default_effort_days) || 3;

  // Execution-phase status IDs
  const executionStatusIds = useMemo(() => {
    return new Set(statuses.filter(s => s.phase === 'execution' || s.phase === 'any').map(s => s.id));
  }, [statuses]);

  // Tasks with do_date (for calendar)
  const { data: allTasks = [] } = useTasks({
    is_archived: 0,
    status_id: statusId,
    sprint_id: sprintId,
    label_id: labelId,
    search: searchText || undefined,
    status_phase: statusPhase || undefined,
  });

  const [hideCompleted, setHideCompleted] = useState(true);
  const doneStatusId = useMemo(() => statuses.find(s => s.name === 'Done')?.id, [statuses]);
  const filteredTasks = useMemo(
    () => hideCompleted && doneStatusId ? allTasks.filter(t => t.status_id !== doneStatusId) : allTasks,
    [allTasks, hideCompleted, doneStatusId],
  );

  // Unscheduled execution-phase tasks (no start/end dates AND no do_date)
  const unscheduledTasks = useMemo(() =>
    filteredTasks.filter(t => !(t.start_date && t.end_date) && !t.do_date && executionStatusIds.has(t.status_id)),
    [filteredTasks, executionStatusIds],
  );

  // Initialize FullCalendar external draggable on sidebar
  useEffect(() => {
    if (!sidebarRef.current) return;
    const draggable = new Draggable(sidebarRef.current, {
      itemSelector: '[data-task-id]',
      eventData: (el) => {
        const taskId = el.getAttribute('data-task-id');
        const title = el.getAttribute('data-task-title') || '';
        return { id: taskId, title, allDay: true };
      },
    });
    return () => draggable.destroy();
  }, []);

  const sprintMap = useMemo(() => {
    const m = new Map<number, string>();
    sprints.forEach(s => m.set(s.id, s.name));
    return m;
  }, [sprints]);

  const statusMap = useMemo(() => new Map(statuses.map(s => [s.id, s])), [statuses]);

  const events: EventInput[] = useMemo(
    () => {
      const result: EventInput[] = [];
      filteredTasks.forEach((t: Task) => {
        const statusColor = statusMap.get(t.status_id)?.color || '#3b82f6';
        if (t.start_date && t.end_date) {
          // Multi-day event (end is exclusive in FullCalendar)
          result.push({
            id: String(t.id),
            title: t.title,
            start: t.start_date,
            end: format(addDays(new Date(t.end_date), 1), 'yyyy-MM-dd'),
            backgroundColor: statusColor,
            borderColor: statusColor,
            extendedProps: { task: t },
            allDay: true,
          });
        } else if (t.do_date) {
          // Single-day event
          result.push({
            id: String(t.id),
            title: t.title,
            date: t.do_date,
            backgroundColor: statusColor,
            borderColor: statusColor,
            extendedProps: { task: t },
          });
        }
      });
      return result;
    },
    [filteredTasks, statusMap],
  );

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      openTaskDetail(Number(info.event.id));
    },
    [openTaskDetail],
  );

  const handleDateClick = useCallback(
    (info: { dateStr: string }) => {
      void info;
    },
    [],
  );

  const handleEventDrop = useCallback(
    (info: EventDropArg) => {
      const taskId = Number(info.event.id);
      const newDate = info.event.startStr;
      updateTask.mutate({ id: taskId, data: { do_date: newDate } });
    },
    [updateTask],
  );

  const handleReceive = useCallback(
    (info: { event: any; draggedEl: HTMLElement }) => {
      const taskId = Number(info.event.id);
      const startDate = info.event.startStr;
      const endDate = format(addDays(new Date(startDate), defaultEffort), 'yyyy-MM-dd');
      // Remove the FullCalendar-created event (we'll let react-query re-render it)
      info.event.remove();
      updateTask.mutate({ id: taskId, data: { start_date: startDate, end_date: endDate, do_date: startDate } });
    },
    [updateTask, defaultEffort],
  );

  const renderEventContent = useCallback(
    (arg: EventContentArg) => {
      const task = arg.event.extendedProps.task as Task;
      const sprintName = task.sprint_id ? sprintMap.get(task.sprint_id) : null;
      return (
        <div className="px-1 py-0.5 overflow-hidden w-full">
          <div className="text-[11px] font-medium truncate">
            {task.is_priority ? '❗️ ' : ''}{task.is_quick ? '⚡️ ' : ''}{task.requires_other ? <span title={task.requires_other_note || 'Requires other'} className="cursor-help">🪢 </span> : ''}{arg.event.title}
          </div>
          {(task.labels.length > 0 || sprintName) && (
            <div className="flex gap-0.5 flex-wrap mt-0.5">
              {task.labels.map(l => (
                <span key={l.id} className="inline-flex items-center gap-0.5 text-[8px] px-1 rounded-full" style={{ backgroundColor: `${l.color}25`, color: l.color }}>
                  <span className="h-1 w-1 rounded-full" style={{ backgroundColor: l.color }} />
                  {l.name}
                </span>
              ))}
              {sprintName && (
                <span className="text-[8px] px-1 rounded bg-white/10 text-white/70">{sprintName}</span>
              )}
            </div>
          )}
        </div>
      );
    },
    [sprintMap],
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* Unscheduled tasks sidebar - only show when there are tasks */}
      {unscheduledTasks.length > 0 && (
      <div className="w-56 flex-shrink-0 border-r border-border flex flex-col h-full bg-card/50">
        <div className="px-3 py-2 border-b border-border">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Unscheduled ({unscheduledTasks.length})
          </h3>
        </div>
        <div ref={sidebarRef} className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {unscheduledTasks.map(t => {
            const status = statuses.find(s => s.id === t.status_id);
            return (
              <div
                key={t.id}
                data-task-id={t.id}
                data-task-title={t.title}
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
          {unscheduledTasks.length === 0 && (
            <div className="text-xs text-muted-foreground/50 text-center py-4">All tasks scheduled</div>
          )}
        </div>
      </div>
      )}

      {/* Calendar */}
      <div className="flex-1 min-w-0 tasker-calendar flex flex-col">
        <div className="flex items-center justify-end px-4 pt-2">
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
        <div className="flex-1 min-h-0 p-4 pt-1">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={events}
            editable
            droppable
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            eventDrop={handleEventDrop}
            eventReceive={handleReceive}
            eventContent={renderEventContent}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: '',
            }}
            height="100%"
            fixedWeekCount={false}
            dayMaxEvents={4}
            eventDisplay="block"
            eventTimeFormat={{ hour: undefined, minute: undefined }}
          />
        </div>
      </div>
    </div>
  );
}
