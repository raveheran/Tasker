import { useState } from 'react';
import { cn } from '@/lib/utils';
import { KanbanBoard } from './KanbanBoard';
import { TaskTable } from './TaskTable';
import type { Status } from '@/types';
import { Kanban, Table2 } from 'lucide-react';

type BacklogView = 'kanban' | 'table';

const PLANNING_FILTER = (status: Status) => status.phase === 'planning';

export function BacklogSpace() {
  const [view, setView] = useState<BacklogView>('kanban');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-1">
        <h2 className="text-lg font-semibold text-foreground mr-4">Backlog</h2>
        <div className="flex items-center bg-secondary rounded-lg p-0.5">
          <button
            onClick={() => setView('kanban')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              view === 'kanban'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Kanban className="h-3.5 w-3.5" />
            <span>Kanban</span>
          </button>
          <button
            onClick={() => setView('table')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              view === 'table'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Table2 className="h-3.5 w-3.5" />
            <span>Table</span>
          </button>
        </div>
        <span className="ml-3 text-xs text-muted-foreground">
          Planning-phase tasks only
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {view === 'kanban' && <KanbanBoard statusFilter={PLANNING_FILTER} />}
        {view === 'table' && <TaskTable statusPhaseOverride="planning" />}
      </div>
    </div>
  );
}
