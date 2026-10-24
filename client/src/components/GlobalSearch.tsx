import { useState, useRef, useEffect } from 'react';
import { Search, X, ListTodo, BookOpen, StickyNote, Archive, Tag } from 'lucide-react';
import { useSearch, useStatuses, useLabels, useUpdateTask } from '@/hooks';
import { useUIStore, useConnectionStore } from '@/store';

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedLabelIds, setSelectedLabelIds] = useState<number[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: results, isLoading } = useSearch(query, selectedLabelIds.length > 0 ? selectedLabelIds : undefined);
  const { data: labels = [] } = useLabels();
  const { openTaskDetail, setActiveSpace, setSelectedNoteId, setSelectedStoryId } = useUIStore();
  const { data: statuses = [] } = useStatuses();
  const updateTask = useUpdateTask();
  const addToast = useConnectionStore((s) => s.addToast);

  // Keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
        setSelectedLabelIds([]);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
        setSelectedLabelIds([]);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const hasResults = results && (results.tasks.length > 0 || results.userStories.length > 0 || results.notes.length > 0);
  const hasActiveSearch = query.trim().length >= 2 || selectedLabelIds.length > 0;

  function handleTaskClick(taskId: number) {
    setActiveSpace('tasks');
    openTaskDetail(taskId);
    setOpen(false);
    setQuery('');
    setSelectedLabelIds([]);
    setSelectedIds(new Set());
  }

  function toggleSelection(taskId: number, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function handleBulkStatus(statusId: number) {
    selectedIds.forEach(id => updateTask.mutate({ id, data: { status_id: statusId } }));
    addToast(`Updated ${selectedIds.size} task(s)`, 'success');
    setSelectedIds(new Set());
  }

  function handleBulkArchive() {
    const count = selectedIds.size;
    const ids = [...selectedIds];
    ids.forEach(id => updateTask.mutate({ id, data: { is_archived: 1 } }));
    addToast(`Archived ${count} task(s)`, 'success', () => {
      ids.forEach(id => updateTask.mutate({ id, data: { is_archived: 0 } }));
    });
    setSelectedIds(new Set());
  }

  function handleStoryClick(storyId: number) {
    setActiveSpace('user-stories');
    setSelectedStoryId(storyId);
    setOpen(false);
    setQuery('');
    setSelectedLabelIds([]);
  }

  function handleNoteClick(noteId: number) {
    setActiveSpace('notes');
    setSelectedNoteId(noteId);
    setOpen(false);
    setQuery('');
    setSelectedLabelIds([]);
  }

  return (
    <>
      {/* Search trigger */}
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground transition-colors text-left"
      >
        <Search className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1">Search</span>
        <kbd className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">⌘K</kbd>
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60">
          <div
            ref={containerRef}
            className="w-full max-w-lg bg-card border border-border rounded-lg shadow-2xl overflow-hidden"
          >
            {/* Input */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tasks, stories, notes…"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                autoFocus
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Label filter */}
            {labels.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-wrap">
                <Tag className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                {labels.map((label) => (
                  <button
                    key={label.id}
                    onClick={() => setSelectedLabelIds(prev =>
                      prev.includes(label.id) ? prev.filter(id => id !== label.id) : [...prev, label.id]
                    )}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors border ${
                      selectedLabelIds.includes(label.id)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary text-muted-foreground border-border hover:border-primary/50'
                    }`}
                    style={selectedLabelIds.includes(label.id) ? { backgroundColor: label.color, borderColor: label.color } : undefined}
                  >
                    {label.name}
                  </button>
                ))}
                {selectedLabelIds.length > 0 && (
                  <button
                    onClick={() => setSelectedLabelIds([])}
                    className="text-xs text-muted-foreground hover:text-foreground ml-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto">
              {isLoading && hasActiveSearch && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">Searching…</div>
              )}

              {hasActiveSearch && !isLoading && !hasResults && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">No results found</div>
              )}

              {!hasActiveSearch && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">Type at least 2 characters or select a label…</div>
              )}

              {hasResults && (
                <div className="py-2">
                  {/* Tasks */}
                  {results!.tasks.length > 0 && (
                    <ResultSection icon={ListTodo} label="Tasks">
                      {results!.tasks.map((t) => (
                        <div key={t.id} className="flex items-center">
                          <button
                            onClick={(e) => toggleSelection(t.id, e)}
                            className="flex-shrink-0 ml-2 mr-1"
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] transition-colors ${
                              selectedIds.has(t.id) ? 'bg-primary border-primary text-white' : 'border-border hover:border-primary/50'
                            }`}>
                              {selectedIds.has(t.id) && '✓'}
                            </div>
                          </button>
                          <button
                            onClick={() => handleTaskClick(t.id)}
                            className="flex-1 flex items-center gap-3 px-2 py-2 hover:bg-secondary/50 transition-colors text-left"
                          >
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: t.status_color }}
                            />
                            <span className="text-sm text-foreground truncate flex-1">{t.title}</span>
                            <span className="text-xs text-muted-foreground">{t.status_name}</span>
                            {t.is_archived === 1 && (
                              <span className="text-[10px] text-muted-foreground bg-secondary px-1 py-0.5 rounded">archived</span>
                            )}
                          </button>
                        </div>
                      ))}
                    </ResultSection>
                  )}

                  {/* User Stories */}
                  {results!.userStories.length > 0 && (
                    <ResultSection icon={BookOpen} label="User Stories">
                      {results!.userStories.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => handleStoryClick(s.id)}
                          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-secondary/50 transition-colors text-left"
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: s.status_color }}
                          />
                          <span className="text-sm text-foreground truncate flex-1">{s.title}</span>
                          <span className="text-xs text-muted-foreground">{s.status_name}</span>
                        </button>
                      ))}
                    </ResultSection>
                  )}

                  {/* Notes */}
                  {results!.notes.length > 0 && (
                    <ResultSection icon={StickyNote} label="Notes">
                      {results!.notes.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => handleNoteClick(n.id)}
                          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-secondary/50 transition-colors text-left"
                        >
                          <StickyNote className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm text-foreground truncate flex-1">{n.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(n.updated_at).toLocaleDateString()}
                          </span>
                        </button>
                      ))}
                    </ResultSection>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {selectedIds.size > 0 ? (
              <div className="px-4 py-2 border-t border-border flex items-center gap-2 text-xs">
                <span className="text-primary font-medium">{selectedIds.size} selected</span>
                <select
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) handleBulkStatus(Number(e.target.value)); e.target.value = ''; }}
                  className="h-6 px-1 bg-secondary text-foreground text-xs rounded border border-input"
                >
                  <option value="" disabled>Move to…</option>
                  {statuses.map(s => <option key={s.id} value={s.id} style={{ color: s.color }}>{s.name}</option>)}
                </select>
                <button
                  onClick={handleBulkArchive}
                  className="flex items-center gap-1 h-6 px-2 bg-secondary text-muted-foreground rounded border border-input hover:text-foreground"
                >
                  <Archive className="h-3 w-3" />
                  Archive
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-muted-foreground">
                <span>↑↓ Navigate</span>
                <span>↵ Open</span>
                <span>Esc Close</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ResultSection({ icon: Icon, label, children }: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      {children}
    </div>
  );
}
