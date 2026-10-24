import { useState, useRef, useEffect } from 'react';
import { useUIStore } from '@/store';
import { useTemplates, useCreateTaskFromTemplate } from '@/hooks';
import { cn } from '@/lib/utils';
import { TaskTable } from './TaskTable';
import { KanbanBoard } from './KanbanBoard';
import { CalendarView } from './CalendarView';
import { WeekView } from './WeekView';
import { TimelineView } from './TimelineView';
import type { TaskViewMode } from '@/types';
import { Table2, Kanban, CalendarDays, CalendarRange, GanttChart, FileText } from 'lucide-react';

const viewModes: { mode: TaskViewMode; label: string; icon: typeof Table2 }[] = [
  { mode: 'table', label: 'Table', icon: Table2 },
  { mode: 'kanban', label: 'Kanban', icon: Kanban },
  { mode: 'timeline', label: 'Timeline', icon: GanttChart },
  { mode: 'calendar', label: 'Calendar', icon: CalendarDays },
  { mode: 'week', label: 'Week', icon: CalendarRange },
];

export function TasksSpace() {
  const { taskViewMode, setTaskViewMode, openTaskDetail } = useUIStore();
  const { data: templates = [] } = useTemplates();
  const createFromTemplate = useCreateTaskFromTemplate();
  const [templateOpen, setTemplateOpen] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);

  // Close template picker on outside click
  useEffect(() => {
    if (!templateOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (templateRef.current && !templateRef.current.contains(e.target as Node)) {
        setTemplateOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [templateOpen]);

  return (
    <div className="flex flex-col h-full">
      {/* View mode toolbar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-1">
        <h2 className="text-lg font-semibold text-foreground mr-4">Tasks</h2>
        <div className="flex items-center bg-secondary rounded-lg p-0.5">
          {viewModes.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setTaskViewMode(mode)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                taskViewMode === mode
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title={label}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* From Template */}
        {templates.length > 0 && (
          <div className="relative ml-6" ref={templateRef}>
            <button
              onClick={() => setTemplateOpen(!templateOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">From Template</span>
            </button>
            {templateOpen && (
              <div className="absolute left-0 top-9 z-50 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[200px] animate-in fade-in-0 zoom-in-95">
                <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  New from Template
                </div>
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      createFromTemplate.mutate({ templateId: t.id }, {
                        onSuccess: (task) => { openTaskDetail(task.id); },
                      });
                      setTemplateOpen(false);
                    }}
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

      {/* Active view */}
      <div className="flex-1 overflow-hidden">
        {taskViewMode === 'table' && <TaskTable />}
        {taskViewMode === 'kanban' && <KanbanBoard />}
        {taskViewMode === 'timeline' && <TimelineView />}
        {taskViewMode === 'calendar' && <CalendarView />}
        {taskViewMode === 'week' && <WeekView />}
      </div>
    </div>
  );
}
