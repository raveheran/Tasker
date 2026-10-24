import { useMemo, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, EventClickArg, EventDropArg, EventContentArg } from '@fullcalendar/core';
import { useTasks, useUpdateTask, useSprints } from '@/hooks';
import { useUIStore, useFilterStore } from '@/store';
import type { Task } from '@/types';

export function WeekView() {
  const { statusId, sprintId, labelId, searchText, statusPhase } = useFilterStore();
  const { openTaskDetail } = useUIStore();
  const updateTask = useUpdateTask();
  const { data: sprints = [] } = useSprints();

  const { data: tasks = [] } = useTasks({
    is_archived: 0,
    has_do_date: true,
    status_id: statusId,
    sprint_id: sprintId,
    label_id: labelId,
    search: searchText || undefined,
    status_phase: statusPhase || undefined,
  });

  const sprintMap = useMemo(() => {
    const m = new Map<number, string>();
    sprints.forEach(s => m.set(s.id, s.name));
    return m;
  }, [sprints]);

  const events: EventInput[] = useMemo(
    () =>
      tasks.map((t: Task) => ({
        id: String(t.id),
        title: t.title,
        date: t.do_date!,
        allDay: true,
        backgroundColor: t.color_override || '#3b82f6',
        borderColor: t.color_override || '#3b82f6',
        extendedProps: { task: t },
      })),
    [tasks],
  );

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      openTaskDetail(Number(info.event.id));
    },
    [openTaskDetail],
  );

  const handleEventDrop = useCallback(
    (info: EventDropArg) => {
      const taskId = Number(info.event.id);
      const newDate = info.event.startStr;
      updateTask.mutate({ id: taskId, data: { do_date: newDate } });
    },
    [updateTask],
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
    <div className="flex flex-col h-full overflow-hidden tasker-calendar">
      <div className="flex-1 min-h-0 p-4">
      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        events={events}
        editable
        droppable
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        eventContent={renderEventContent}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: '',
        }}
        height="100%"
        allDaySlot
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        eventDisplay="block"
        nowIndicator
      />
      </div>
    </div>
  );
}
