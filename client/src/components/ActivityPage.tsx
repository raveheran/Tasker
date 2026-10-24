import { Trash2 } from 'lucide-react';
import ActivityLog from './ActivityLog';
import { useDeleteAllActivity } from '@/hooks';

export function ActivityPage() {
  const deleteAll = useDeleteAllActivity();

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Activity Log</h1>
        <button
          onClick={() => {
            if (confirm('Delete all activity history? This cannot be undone.')) {
              deleteAll.mutate();
            }
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 rounded-md transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear history
        </button>
      </div>
      <ActivityLog />
    </div>
  );
}
