import { useEffect, useRef, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Plus, Pencil, Trash2, Layers, ArrowRightLeft, AlertTriangle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspaces, useCreateWorkspace, useRenameWorkspace, useDeleteWorkspace } from '@/hooks';
import { useConnectionStore } from '@/store';
import { getActiveWorkspaceId, switchWorkspace } from '@/lib/workspace';
import type { Workspace } from '@/types';

const MAX_NAME_LENGTH = 60;

function WorkspaceRow({
  workspace,
  isActive,
  onDelete,
}: {
  workspace: Workspace;
  isActive: boolean;
  onDelete: (w: Workspace) => void;
}) {
  const rename = useRenameWorkspace();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(workspace.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function startEdit() {
    setDraft(workspace.name);
    setEditing(true);
  }

  function commit() {
    const name = draft.trim();
    setEditing(false);
    if (!name || name === workspace.name) return;
    rename.mutate({ id: workspace.id, name });
  }

  const unavailable = workspace.status !== 'ok';
  const canDelete = !workspace.is_default && !isActive;
  const deleteHint = workspace.is_default
    ? 'The Default workspace holds your original data and cannot be deleted'
    : isActive
      ? 'Switch to another workspace to delete this one'
      : 'Delete workspace';

  return (
    <div className={cn('flex items-start gap-3 py-3 px-3 rounded-md group', isActive ? 'bg-secondary/50' : 'hover:bg-secondary/30')}>
      <Layers className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              maxLength={MAX_NAME_LENGTH}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="h-7 px-2 bg-secondary text-foreground text-sm rounded border border-input min-w-0 flex-1 max-w-xs"
            />
          ) : (
            <span className="text-sm font-medium text-foreground truncate">{workspace.name}</span>
          )}
          {isActive && (
            <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/20 text-primary flex-shrink-0">
              Active
            </span>
          )}
          {workspace.is_default && (
            <span title="Your original data" className="flex-shrink-0 text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
          )}
        </div>

        <div className="text-xs text-muted-foreground mt-0.5 truncate font-mono" title={workspace.path}>
          {workspace.path}
        </div>

        {unavailable ? (
          <div className="flex items-center gap-1 text-xs text-yellow-400 mt-1">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            <span className="truncate" title={workspace.error}>
              {workspace.status === 'missing' ? 'Database file not found' : `Cannot be opened: ${workspace.error}`}
            </span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground mt-1">
            {workspace.task_count ?? 0} {workspace.task_count === 1 ? 'task' : 'tasks'}
            {workspace.last_modified && <> · modified {formatDistanceToNow(new Date(workspace.last_modified), { addSuffix: true })}</>}
            {' · '}created {format(new Date(workspace.created_at), 'MMM d, yyyy')}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {!isActive && (
          <button
            onClick={() => switchWorkspace(workspace.id)}
            disabled={unavailable}
            title={unavailable ? 'This workspace cannot be opened' : 'Switch to this workspace'}
            className="h-7 px-2 flex items-center gap-1 text-xs rounded bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowRightLeft className="h-3 w-3" />
            Switch
          </button>
        )}
        <button
          onClick={startEdit}
          title="Rename"
          className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => canDelete && onDelete(workspace)}
          disabled={!canDelete}
          title={deleteHint}
          className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-secondary disabled:opacity-30 disabled:hover:text-muted-foreground disabled:hover:bg-transparent disabled:cursor-not-allowed"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Two-step delete: a warning first, then a final dialog that requires typing the workspace name. */
function DeleteWorkspaceDialog({ workspace, onClose }: { workspace: Workspace; onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState('');
  const del = useDeleteWorkspace();
  const addToast = useConnectionStore((s) => s.addToast);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function confirmDelete() {
    del.mutate(
      { id: workspace.id, confirmName: typed },
      {
        onSuccess: (res) => {
          addToast(
            res.trashed_to
              ? `Workspace "${workspace.name}" deleted. Its files were moved to ${res.trashed_to}`
              : `Workspace "${workspace.name}" removed.`,
            'success',
          );
          onClose();
        },
      },
    );
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md bg-card border border-border rounded-lg shadow-xl p-5 space-y-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {step === 1 ? (
          <>
            <div className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              <h3 className="text-base font-semibold">Delete “{workspace.name}”?</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              This removes the workspace and everything in it
              {workspace.task_count ? <> — including its <strong className="text-foreground">{workspace.task_count} tasks</strong></> : null},
              along with its notes, user stories, templates and uploaded images.
            </p>
            <p className="text-xs text-muted-foreground">
              The files are moved to a trash folder rather than erased, but Tasker has no undo for this.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="h-8 px-3 bg-secondary text-foreground text-sm rounded-md hover:bg-secondary/80">
                Cancel
              </button>
              <button
                onClick={() => setStep(2)}
                className="h-8 px-3 bg-destructive/90 text-white text-sm rounded-md hover:bg-destructive"
              >
                Yes, continue
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h3 className="text-base font-semibold">Are you absolutely sure?</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Type <strong className="text-foreground">{workspace.name}</strong> to confirm deletion.
            </p>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && typed === workspace.name && !del.isPending && confirmDelete()}
              placeholder={workspace.name}
              className="w-full h-8 px-3 bg-secondary text-foreground text-sm rounded-md border border-input"
            />
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="h-8 px-3 bg-secondary text-foreground text-sm rounded-md hover:bg-secondary/80">
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={typed !== workspace.name || del.isPending}
                className="h-8 px-3 bg-destructive text-white text-sm rounded-md hover:bg-destructive/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {del.isPending ? 'Deleting…' : 'Delete workspace'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function WorkspaceSettings() {
  const { data: workspaces = [], isLoading } = useWorkspaces(true);
  const create = useCreateWorkspace();
  const [newName, setNewName] = useState('');
  const [toDelete, setToDelete] = useState<Workspace | null>(null);
  const activeId = getActiveWorkspaceId();

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    create.mutate(name, { onSuccess: () => setNewName('') });
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-foreground mb-1">Workspaces</h3>
      <p className="text-xs text-muted-foreground mb-3">
        Each workspace is a separate database on this computer, with its own tasks, notes, statuses, sprints and labels.
        Different browser tabs can work in different workspaces at the same time.
      </p>

      <div className="space-y-1">
        {isLoading && <div className="text-sm text-muted-foreground px-3 py-2">Loading…</div>}
        {workspaces.map((w) => (
          <WorkspaceRow key={w.id} workspace={w} isActive={w.id === activeId} onDelete={setToDelete} />
        ))}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <input
          type="text"
          placeholder="New workspace name..."
          value={newName}
          maxLength={MAX_NAME_LENGTH}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          className="flex-1 h-8 px-3 bg-secondary text-foreground text-sm rounded-md border border-input"
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim() || create.isPending}
          className="h-8 px-3 flex items-center gap-1 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Create
        </button>
      </div>

      {toDelete && <DeleteWorkspaceDialog workspace={toDelete} onClose={() => setToDelete(null)} />}
    </div>
  );
}
