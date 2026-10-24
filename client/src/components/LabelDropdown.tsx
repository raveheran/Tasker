import { useState, useRef, useEffect } from 'react';
import { Search, X, Pencil, Trash2, Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLabels, useCreateLabel, useUpdateLabel, useDeleteLabel } from '@/hooks';
import type { Label } from '@/types';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#6b7280', '#78716c',
];

export function LabelDropdown({
  selectedIds,
  onToggle,
}: {
  selectedIds: number[];
  onToggle: (labelId: number) => void;
}) {
  const { data: labels = [] } = useLabels();
  const createLabel = useCreateLabel();
  const updateLabel = useUpdateLabel();
  const deleteLabel = useDeleteLabel();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setEditingId(null);
        setCreating(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = labels.filter(l =>
    !l.is_hidden && l.name.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (l: Label) => {
    setEditingId(l.id);
    setEditName(l.name);
    setEditColor(l.color);
    setCreating(false);
  };

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      updateLabel.mutate({ id: editingId, data: { name: editName.trim(), color: editColor } });
    }
    setEditingId(null);
  };

  const handleCreate = () => {
    if (newName.trim()) {
      createLabel.mutate({ name: newName.trim(), color: newColor }, {
        onSuccess: (l) => {
          onToggle(l.id);
          setNewName('');
          setCreating(false);
        },
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this label? It will be removed from all tasks.')) {
      deleteLabel.mutate(id);
      setEditingId(null);
    }
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md border border-input transition-colors"
      >
        <Plus className="h-3 w-3" />
        Add label
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-72 bg-popover border border-border rounded-lg shadow-xl max-h-[380px] flex flex-col">
          {/* Search */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border">
            <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search labels…"
              className="flex-1 bg-transparent text-sm text-foreground focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Label list */}
          <div className="flex-1 overflow-y-auto py-1">
            {filtered.map(l => (
              <div key={l.id}>
                {editingId === l.id ? (
                  /* Edit mode */
                  <div className="px-3 py-2 space-y-2 bg-secondary/30">
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      className="w-full h-7 px-2 bg-secondary text-foreground text-sm rounded border border-input focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <div className="flex flex-wrap gap-1">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => setEditColor(c)}
                          className={cn(
                            'h-5 w-5 rounded-full border-2 transition-transform',
                            editColor === c ? 'border-white scale-125' : 'border-transparent hover:scale-110'
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground rounded hover:bg-secondary">Cancel</button>
                      <button onClick={saveEdit} className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90">Save</button>
                    </div>
                  </div>
                ) : (
                  /* Normal row */
                  <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-secondary/40 group">
                    <button
                      onClick={() => onToggle(l.id)}
                      className={cn(
                        'h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                        selectedIds.includes(l.id)
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-input hover:border-primary'
                      )}
                    >
                      {selectedIds.includes(l.id) && <Check className="h-3 w-3" />}
                    </button>
                    <span
                      className="flex items-center gap-1.5 flex-1 text-sm cursor-pointer font-medium"
                      style={{ color: l.color }}
                      onClick={() => onToggle(l.id)}
                    >
                      <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
                      {l.name}
                    </span>
                    <button
                      onClick={() => startEdit(l)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-0.5"
                      title="Edit label"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(l.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5"
                      title="Delete label"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {filtered.length === 0 && !creating && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No labels found</div>
            )}
          </div>

          {/* Create new */}
          <div className="border-t border-border">
            {creating ? (
              <div className="px-3 py-2 space-y-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
                  placeholder="Label name"
                  className="w-full h-7 px-2 bg-secondary text-foreground text-sm rounded border border-input focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="flex flex-wrap gap-1">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={cn(
                        'h-5 w-5 rounded-full border-2 transition-transform',
                        newColor === c ? 'border-white scale-125' : 'border-transparent hover:scale-110'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-1 justify-end">
                  <button onClick={() => setCreating(false)} className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground rounded hover:bg-secondary">Cancel</button>
                  <button onClick={handleCreate} className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90">Create</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setCreating(true); setEditingId(null); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> New label
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
