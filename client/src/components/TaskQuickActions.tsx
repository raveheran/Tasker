import { useRef } from 'react';
import { Check, Trash2, Calendar, Copy } from 'lucide-react';
import { useUpdateTask, useDeleteTask, useStatuses, useDuplicateTask } from '@/hooks';

/** Inline quick-action icons: mark Done + calendar + delete */
export function TaskQuickActions({ taskId, size = 'sm' }: { taskId: number; size?: 'xs' | 'sm' }) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { data: statuses = [] } = useStatuses();
  const duplicateTask = useDuplicateTask();
  const dateRef = useRef<HTMLInputElement>(null);

  const markDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    const doneStatus = statuses.find(s => s.name === 'Done');
    if (doneStatus) {
      updateTask.mutate({ id: taskId, data: { status_id: doneStatus.id } });
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this task?')) {
      deleteTask.mutate(taskId);
    }
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateTask.mutate(taskId);
  };

  const handleCalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    dateRef.current?.showPicker();
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const val = e.target.value || null;
    updateTask.mutate({ id: taskId, data: { do_date: val } });
  };

  const iconSize = size === 'xs' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const btnSize = size === 'xs' ? 'p-0.5' : 'p-1';

  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
      <button
        onClick={markDone}
        className={`${btnSize} rounded hover:bg-green-500/20 text-muted-foreground hover:text-green-500 transition-colors`}
        title="Mark as Done"
      >
        <Check className={iconSize} />
      </button>
      <div className="relative">
        <button
          onClick={handleCalClick}
          className={`${btnSize} rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors`}
          title="Set Do Date"
        >
          <Calendar className={iconSize} />
        </button>
        <input
          ref={dateRef}
          type="date"
          onChange={handleDateChange}
          onClick={e => e.stopPropagation()}
          className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
          tabIndex={-1}
        />
      </div>
      <button
        onClick={handleDuplicate}
        className={`${btnSize} rounded hover:bg-blue-500/20 text-muted-foreground hover:text-blue-500 transition-colors`}
        title="Duplicate task"
      >
        <Copy className={iconSize} />
      </button>
      <button
        onClick={handleDelete}
        className={`${btnSize} rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors`}
        title="Delete task"
      >
        <Trash2 className={iconSize} />
      </button>
    </div>
  );
}
