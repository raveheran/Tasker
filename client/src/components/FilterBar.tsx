import { useUIStore, useFilterStore } from '@/store';
import { useStatuses, useSprints, useLabels, useCreateSprint, useCreateLabel } from '@/hooks';
import { Search, X, ArrowUpDown } from 'lucide-react';
import type { SortField } from '@/store';

export function FilterBar() {
  const { statusId, sprintId, labelId, searchText, statusPhase, sortField, sortDir, setStatusId, setSprintId, setLabelId, setSearchText, setSortField, setSortDir, clearFilters } =
    useFilterStore();
  const { data: statuses } = useStatuses();
  const { data: sprints } = useSprints();
  const { data: labels } = useLabels();
  const { activeSpace } = useUIStore();
  const createSprint = useCreateSprint();
  const createLabel = useCreateLabel();

  const hasFilters = statusId || sprintId || labelId || searchText || statusPhase;

  const handleSprintChange = (val: string) => {
    if (val === '__new__') {
      const name = prompt('New sprint name:');
      if (name?.trim()) {
        createSprint.mutate({ name: name.trim() }, {
          onSuccess: (s) => setSprintId(s.id),
        });
      }
    } else {
      setSprintId(val ? Number(val) : undefined);
    }
  };

  const handleLabelChange = (val: string) => {
    if (val === '__new__') {
      const name = prompt('New label name:');
      if (name?.trim()) {
        createLabel.mutate({ name: name.trim() }, {
          onSuccess: (l) => setLabelId(l.id),
        });
      }
    } else {
      setLabelId(val ? Number(val) : undefined);
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50 flex-wrap">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="h-8 pl-7 pr-3 bg-secondary text-foreground text-sm rounded-md border border-input w-48 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Status filter */}
      <select
        value={statusId ?? ''}
        onChange={(e) => setStatusId(e.target.value ? Number(e.target.value) : undefined)}
        className="h-8 px-2 bg-secondary text-sm rounded-md border border-input focus:outline-none focus:ring-1 focus:ring-ring font-medium"
        style={{ color: statusId ? statuses?.find(s => s.id === statusId)?.color : undefined }}
      >
        <option value="" style={{ color: 'inherit' }}>All statuses</option>
        {statuses?.map((s) => (
          <option key={s.id} value={s.id} style={{ color: s.color }}>{s.name}</option>
        ))}
      </select>

      {/* Sprint filter */}
      {activeSpace !== 'backlog' && (
        <select
          value={sprintId ?? ''}
          onChange={(e) => handleSprintChange(e.target.value)}
          className="h-8 px-2 bg-secondary text-foreground text-sm rounded-md border border-input focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All sprints</option>
          {sprints?.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
          <option value="__new__">+ New sprint…</option>
        </select>
      )}

      {/* Label filter */}
      <select
        value={labelId ?? ''}
        onChange={(e) => handleLabelChange(e.target.value)}
        className="h-8 px-2 bg-secondary text-sm rounded-md border border-input focus:outline-none focus:ring-1 focus:ring-ring font-medium"
        style={{ color: labelId ? labels?.find(l => l.id === labelId)?.color : undefined }}
      >
        <option value="" style={{ color: 'inherit' }}>All labels</option>
        {labels?.map((l) => (
          <option key={l.id} value={l.id} style={{ color: l.color }}>{l.name}</option>
        ))}
        <option value="__new__" style={{ color: 'inherit' }}>+ New label…</option>
      </select>

      {/* Sort */}
      <div className="flex items-center gap-1">
        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value as SortField)}
          className="h-8 px-1 bg-secondary text-foreground text-xs rounded-md border border-input focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="created_at">Created</option>
          <option value="do_date">Do Date</option>
          <option value="sprint">Sprint</option>
          <option value="label">Label</option>
          <option value="title">Title</option>
        </select>
        <button
          onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
          className="h-8 px-1.5 bg-secondary text-foreground text-xs rounded-md border border-input hover:bg-secondary/80"
        >
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={() => { clearFilters(); }}
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <X className="h-3 w-3" /> Clear
        </button>
      )}
    </div>
  );
}
