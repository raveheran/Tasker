import { useState } from 'react';
import { Plus, Trash2, GripVertical, Download, Eye, EyeOff } from 'lucide-react';
import { useStatuses, useCreateStatus, useUpdateStatus, useDeleteStatus, useSprints, useCreateSprint, useUpdateSprint, useDeleteSprint, useActivateSprint, useLabels, useCreateLabel, useUpdateLabel, useDeleteLabel, useSettings, useUpdateSetting } from '@/hooks';
import type { Status } from '@/types';
import { withWorkspace } from '@/lib/workspace';
import { WorkspaceSettings } from '@/components/WorkspaceSettings';

function StatusRow({ status, onUpdate, onDelete }: { status: Status; onUpdate: (data: Partial<Status>) => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded hover:bg-secondary/30 group">
      <GripVertical className="h-4 w-4 text-muted-foreground/30 cursor-grab" />
      <input
        type="color"
        value={status.color}
        onChange={(e) => onUpdate({ color: e.target.value })}
        className="h-6 w-6 rounded border-0 cursor-pointer bg-transparent"
      />
      <input
        value={status.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        className="flex-1 h-7 px-2 bg-transparent text-foreground text-sm border-none focus:outline-none focus:bg-secondary rounded"
      />
      <select
        value={status.phase}
        onChange={(e) => onUpdate({ phase: e.target.value as Status['phase'] })}
        className="h-7 px-2 bg-secondary text-foreground text-xs rounded border border-input"
      >
        <option value="planning">Planning</option>
        <option value="execution">Execution</option>
        <option value="any">Any</option>
      </select>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function StatusSettings() {
  const { data: statuses = [] } = useStatuses();
  const createStatus = useCreateStatus();
  const updateStatus = useUpdateStatus();
  const deleteStatus = useDeleteStatus();
  const [newName, setNewName] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) return;
    createStatus.mutate({ name: newName.trim(), phase: 'execution' });
    setNewName('');
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-foreground mb-3">Statuses</h3>
      <div className="space-y-0.5">
        {statuses.map((s) => (
          <StatusRow
            key={s.id}
            status={s}
            onUpdate={(data) => updateStatus.mutate({ id: s.id, data })}
            onDelete={() => {
              if (confirm(`Delete status "${s.name}"?`)) deleteStatus.mutate(s.id);
            }}
          />
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <input
          type="text"
          placeholder="New status name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1 h-8 px-3 bg-secondary text-foreground text-sm rounded-md border border-input"
        />
        <button onClick={handleAdd} className="h-8 px-3 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SprintSettings() {
  const { data: sprints = [] } = useSprints();
  const createSprint = useCreateSprint();
  const updateSprint = useUpdateSprint();
  const deleteSprint = useDeleteSprint();
  const activateSprint = useActivateSprint();
  const [newName, setNewName] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) return;
    createSprint.mutate({ name: newName.trim() });
    setNewName('');
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-foreground mb-3">Sprints</h3>
      <div className="space-y-1">
        {sprints.map((s) => (
          <div key={s.id} className="flex items-center gap-3 py-2 px-3 rounded hover:bg-secondary/30 group">
            <button
              onClick={() => activateSprint.mutate(s.id)}
              className={`h-3 w-3 rounded-full border-2 ${s.is_active ? 'bg-primary border-primary' : 'border-muted-foreground'}`}
              title={s.is_active ? 'Active sprint' : 'Set as active'}
            />
            <input
              value={s.name}
              onChange={(e) => updateSprint.mutate({ id: s.id, data: { name: e.target.value } })}
              className="flex-1 h-7 px-2 bg-transparent text-foreground text-sm border-none focus:outline-none focus:bg-secondary rounded"
            />
            <input
              type="date"
              value={s.start_date ?? ''}
              onChange={(e) => updateSprint.mutate({ id: s.id, data: { start_date: e.target.value || null } })}
              className="h-7 px-1 bg-secondary text-foreground text-xs rounded border border-input"
            />
            <span className="text-muted-foreground text-xs">→</span>
            <input
              type="date"
              value={s.end_date ?? ''}
              onChange={(e) => updateSprint.mutate({ id: s.id, data: { end_date: e.target.value || null } })}
              className="h-7 px-1 bg-secondary text-foreground text-xs rounded border border-input"
            />
            <button
              onClick={() => { if (confirm(`Delete sprint "${s.name}"?`)) deleteSprint.mutate(s.id); }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <input
          type="text"
          placeholder="New sprint name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1 h-8 px-3 bg-secondary text-foreground text-sm rounded-md border border-input"
        />
        <button onClick={handleAdd} className="h-8 px-3 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function LabelSettings() {
  const { data: labels = [] } = useLabels();
  const createLabel = useCreateLabel();
  const updateLabel = useUpdateLabel();
  const deleteLabel = useDeleteLabel();
  const [newName, setNewName] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) return;
    createLabel.mutate({ name: newName.trim() });
    setNewName('');
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-foreground mb-3">Labels</h3>
      <p className="text-xs text-muted-foreground mb-3">
        Hide a label to archive it without deleting it — hidden labels are removed from the label picker but stay on tasks that already use them.
      </p>
      <div className="space-y-0.5">
        {labels.map((l) => (
          <div key={l.id} className={`flex items-center gap-3 py-2 px-3 rounded hover:bg-secondary/30 group ${l.is_hidden ? 'opacity-50' : ''}`}>
            <input
              type="color"
              value={l.color}
              onChange={(e) => updateLabel.mutate({ id: l.id, data: { color: e.target.value } })}
              className="h-6 w-6 rounded border-0 cursor-pointer bg-transparent"
            />
            <input
              value={l.name}
              onChange={(e) => updateLabel.mutate({ id: l.id, data: { name: e.target.value } })}
              className="flex-1 h-7 px-2 bg-transparent text-foreground text-sm border-none focus:outline-none focus:bg-secondary rounded"
            />
            <button
              onClick={() => updateLabel.mutate({ id: l.id, data: { is_hidden: l.is_hidden ? 0 : 1 } })}
              className={`text-muted-foreground hover:text-foreground transition-opacity ${l.is_hidden ? '' : 'opacity-0 group-hover:opacity-100'}`}
              title={l.is_hidden ? 'Unhide label (show in picker)' : 'Hide label (archive from picker)'}
            >
              {l.is_hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              onClick={() => { if (confirm(`Delete label "${l.name}"?`)) deleteLabel.mutate(l.id); }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <input
          type="text"
          placeholder="New label name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1 h-8 px-3 bg-secondary text-foreground text-sm rounded-md border border-input"
        />
        <button onClick={handleAdd} className="h-8 px-3 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function SettingsPage() {
  return (
    <div className="p-6 max-w-2xl space-y-8 h-full overflow-y-auto">
      <h2 className="text-xl font-semibold text-foreground">Settings</h2>
      <WorkspaceSettings />
      <GeneralSettings />
      <StatusSettings />
      <SprintSettings />
      <LabelSettings />
      <ExportSection />
    </div>
  );
}

function GeneralSettings() {
  const { data: settings } = useSettings();
  const { data: statuses = [] } = useStatuses();
  const updateSetting = useUpdateSetting();
  const defaultEffort = settings?.default_effort_days ?? '3';
  const defaultTaskStatus = settings?.default_task_status ?? 'To Do';

  return (
    <div>
      <h3 className="text-sm font-medium text-foreground mb-3">General</h3>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted-foreground">Default task effort (days)</label>
          <input
            type="number"
            min="1"
            max="30"
            step="1"
            value={defaultEffort}
            onChange={(e) => updateSetting.mutate({ key: 'default_effort_days', value: e.target.value })}
            className="w-20 h-8 px-2 bg-secondary text-foreground text-sm rounded-md border border-input"
          />
          <span className="text-xs text-muted-foreground">Used when dragging unscheduled tasks to calendar/timeline</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted-foreground">Default status for new tasks</label>
          <select
            value={defaultTaskStatus}
            onChange={(e) => updateSetting.mutate({ key: 'default_task_status', value: e.target.value })}
            className="h-8 px-2 bg-secondary text-foreground text-sm rounded-md border border-input"
          >
            {statuses.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">Not used when adding via status-grouped Kanban</span>
        </div>
      </div>
    </div>
  );
}

function ExportSection() {
  return (
    <div>
      <h3 className="text-sm font-medium text-foreground mb-3">Data Export</h3>
      <div className="flex items-center gap-3">
        <a
          href={withWorkspace('/api/export/json')}
          download
          className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-foreground text-sm rounded-md hover:bg-secondary/80 transition-colors"
        >
          <Download className="h-4 w-4" />
          Export All (JSON)
        </a>
        <a
          href={withWorkspace('/api/export/tasks-csv')}
          download
          className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-foreground text-sm rounded-md hover:bg-secondary/80 transition-colors"
        >
          <Download className="h-4 w-4" />
          Export Tasks (CSV)
        </a>
        <a
          href={withWorkspace('/api/export/tasks-csv?include_archived=true')}
          download
          className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-foreground text-sm rounded-md hover:bg-secondary/80 transition-colors"
        >
          <Download className="h-4 w-4" />
          All Tasks + Archived (CSV)
        </a>
      </div>
    </div>
  );
}
