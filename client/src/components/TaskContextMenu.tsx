import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useStatuses, useUpdateTask, useDuplicateTask } from '@/hooks';
import { useUIStore, useConnectionStore } from '@/store';
import type { Task } from '@/types';
import { Eye, Archive, Check, Copy, ChevronRight } from 'lucide-react';

interface Props {
  task: Task;
  children: ReactNode | ((onContextMenu: (e: React.MouseEvent) => void) => ReactNode);
}

export function TaskContextMenu({ task, children }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [statusSubmenuOpen, setStatusSubmenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { data: statuses = [] } = useStatuses();
  const updateTask = useUpdateTask();
  const duplicateTask = useDuplicateTask();
  const { openTaskDetail } = useUIStore();
  const addToast = useConnectionStore((s) => s.addToast);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 300);
    setPosition({ x, y });
    setStatusSubmenuOpen(false);
    setOpen(true);
  };

  const handleMoveToStatus = (statusId: number) => {
    const oldStatusId = task.status_id;
    const statusName = statuses.find(s => s.id === statusId)?.name || 'status';
    updateTask.mutate({ id: task.id, data: { status_id: statusId } }, {
      onSuccess: () => {
        addToast(`Moved "${task.title}" to ${statusName}`, 'success', () => {
          updateTask.mutate({ id: task.id, data: { status_id: oldStatusId } });
        });
      },
    });
    setOpen(false);
  };

  const handleMarkDone = () => {
    const doneStatus = statuses.find(s => s.name === 'Done');
    if (doneStatus) handleMoveToStatus(doneStatus.id);
  };

  const handleDuplicate = () => {
    duplicateTask.mutate(task.id, {
      onSuccess: (newTask: any) => openTaskDetail(newTask.id),
    });
    setOpen(false);
  };

  const handleArchive = () => {
    updateTask.mutate({ id: task.id, data: { is_archived: 1 } }, {
      onSuccess: () => {
        addToast(`Archived "${task.title}"`, 'success', () => {
          updateTask.mutate({ id: task.id, data: { is_archived: 0 } });
        });
      },
    });
    setOpen(false);
  };

  const handleOpenDetail = () => {
    openTaskDetail(task.id);
    setOpen(false);
  };

  const doneStatus = statuses.find(s => s.name === 'Done');
  const isDone = doneStatus && task.status_id === doneStatus.id;

  // Group statuses by phase
  const planningStatuses = statuses.filter((s) => s.phase === 'planning');
  const executionStatuses = statuses.filter((s) => s.phase === 'execution');
  const otherStatuses = statuses.filter((s) => s.phase === 'any');

  return (
    <>
      {typeof children === 'function'
        ? children(handleContextMenu)
        : <div onContextMenu={handleContextMenu}>{children}</div>}

      {open && (
        <div
          ref={menuRef}
          className="fixed z-[100] bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[200px] animate-in fade-in-0 zoom-in-95"
          style={{ left: position.x, top: position.y }}
        >
          {/* Open detail */}
          <button
            onClick={handleOpenDetail}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors text-left"
          >
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            Open Details
          </button>

          <div className="h-px bg-border my-1" />

          {/* Mark as Done */}
          {!isDone && (
            <button
              onClick={handleMarkDone}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors text-left"
            >
              <Check className="h-3.5 w-3.5 text-green-400" />
              Mark as Done
            </button>
          )}

          {/* Move to status - submenu */}
          <div className="relative"
            onMouseEnter={() => setStatusSubmenuOpen(true)}
            onMouseLeave={() => setStatusSubmenuOpen(false)}
          >
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors text-left"
            >
              <div className="h-3.5 w-3.5 rounded-full flex-shrink-0 border border-muted-foreground/30" style={{ backgroundColor: statuses.find(s => s.id === task.status_id)?.color }} />
              Move to…
              <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
            </button>

            {statusSubmenuOpen && (
              <div
                className="absolute left-full top-0 ml-0.5 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[180px] animate-in fade-in-0 zoom-in-95"
              >
                {planningStatuses.length > 0 && (
                  <>
                    <div className="px-3 py-0.5 text-[10px] text-muted-foreground/60">Planning</div>
                    {planningStatuses.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleMoveToStatus(s.id)}
                        disabled={s.id === task.status_id}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors text-left disabled:opacity-30 disabled:cursor-default"
                      >
                        <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                        <span style={{ color: s.color }}>{s.name}</span>
                        {s.id === task.status_id && <span className="ml-auto text-[10px] text-muted-foreground">current</span>}
                      </button>
                    ))}
                  </>
                )}

                {executionStatuses.length > 0 && (
                  <>
                    <div className="px-3 py-0.5 text-[10px] text-muted-foreground/60 mt-1">Execution</div>
                    {executionStatuses.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleMoveToStatus(s.id)}
                        disabled={s.id === task.status_id}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors text-left disabled:opacity-30 disabled:cursor-default"
                      >
                        <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                        <span style={{ color: s.color }}>{s.name}</span>
                        {s.id === task.status_id && <span className="ml-auto text-[10px] text-muted-foreground">current</span>}
                      </button>
                    ))}
                  </>
                )}

                {otherStatuses.length > 0 && (
                  <>
                    {otherStatuses.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleMoveToStatus(s.id)}
                        disabled={s.id === task.status_id}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors text-left disabled:opacity-30 disabled:cursor-default"
                      >
                        <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                        <span style={{ color: s.color }}>{s.name}</span>
                        {s.id === task.status_id && <span className="ml-auto text-[10px] text-muted-foreground">current</span>}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Duplicate */}
          <button
            onClick={handleDuplicate}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors text-left"
          >
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            Duplicate
          </button>

          <div className="h-px bg-border my-1" />

          {/* Archive */}
          <button
            onClick={handleArchive}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-left"
          >
            <Archive className="h-3.5 w-3.5" />
            Archive
          </button>
        </div>
      )}
    </>
  );
}
