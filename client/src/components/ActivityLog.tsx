import { useActivityLog } from '@/hooks';
import { useUIStore } from '@/store';
import { Clock, ArrowRight, Plus, Trash2, Edit2 } from 'lucide-react';

const ACTION_ICONS: Record<string, typeof Clock> = {
  created: Plus,
  updated: Edit2,
  status_changed: ArrowRight,
  deleted: Trash2,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr + 'Z').getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function ActivityLog({ entityType, entityId }: { entityType?: string; entityId?: number }) {
  const { data: entries = [], isLoading } = useActivityLog({ entity_type: entityType, entity_id: entityId, limit: 50 });
  const openTaskDetail = useUIStore((s) => s.openTaskDetail);

  if (isLoading) return <div className="text-muted-foreground text-sm p-4">Loading activity…</div>;
  if (entries.length === 0) return <div className="text-muted-foreground text-sm p-4">No activity yet.</div>;

  return (
    <div className="space-y-1">
      {entries.map((entry) => {
        const Icon = ACTION_ICONS[entry.action] || Clock;
        return (
          <div
            key={entry.id}
            className="flex items-start gap-3 px-3 py-2 rounded-md hover:bg-card/60 group"
          >
            <div className="mt-0.5 text-muted-foreground">
              <Icon size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground truncate">
                {entry.details || entry.action}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>{timeAgo(entry.created_at)}</span>
                {entry.entity_type === 'task' && (
                  <button
                    onClick={() => openTaskDetail(entry.entity_id)}
                    className="hover:text-primary"
                  >
                    #{entry.entity_id}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
