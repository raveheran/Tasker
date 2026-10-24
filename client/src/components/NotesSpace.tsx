import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, StickyNote, Search, X, ChevronRight, ChevronDown, FileText, GripVertical, Link2 } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { cn } from '@/lib/utils';
import { handleEditorPaste } from '@/lib/imageUpload';
import { useNotes, useNote, useCreateNote, useUpdateNote, useDeleteNote, useSprints, useTemplates, useCreateNoteFromTemplate, useReorderNotes, useNoteLinkedTasks, useAddNoteTaskLink, useRemoveNoteTaskLink, useTasks } from '@/hooks';
import { useUIStore } from '@/store';
import { LabelDropdown } from './LabelDropdown';
import type { Note, Template } from '@/types';

// ── Tree helpers ──

interface TreeNode {
  note: Note;
  children: TreeNode[];
}

function buildTree(notes: Note[]): TreeNode[] {
  const map = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];
  for (const note of notes) {
    map.set(note.id, { note, children: [] });
  }
  for (const note of notes) {
    const node = map.get(note.id)!;
    if (note.parent_id && map.has(note.parent_id)) {
      map.get(note.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.note.sort_order - b.note.sort_order);
    nodes.forEach(n => sortChildren(n.children));
  };
  sortChildren(roots);
  return roots;
}

function flattenTree(nodes: TreeNode[], collapsed: Set<number>, depth = 0): { note: Note; depth: number; hasChildren: boolean }[] {
  const result: { note: Note; depth: number; hasChildren: boolean }[] = [];
  for (const node of nodes) {
    const hasChildren = node.children.length > 0;
    result.push({ note: node.note, depth, hasChildren });
    if (hasChildren && !collapsed.has(node.note.id)) {
      result.push(...flattenTree(node.children, collapsed, depth + 1));
    }
  }
  return result;
}

// ── Note Tree Item ──

function NoteTreeItem({
  note, depth, hasChildren, isCollapsed, isSelected,
  onSelect, onDelete, onToggleCollapse, onDragStart, onDragOver, onDrop,
}: {
  note: Note; depth: number; hasChildren: boolean; isCollapsed: boolean; isSelected: boolean;
  onSelect: (id: number) => void; onDelete: (id: number) => void; onToggleCollapse: (id: number) => void;
  onDragStart: (e: React.DragEvent, id: number) => void; onDragOver: (e: React.DragEvent, id: number) => void; onDrop: (e: React.DragEvent, id: number) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, note.id)}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); onDragOver(e, note.id); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); onDrop(e, note.id); }}
      onClick={() => onSelect(note.id)}
      className={cn(
        'flex items-center gap-1 px-2 py-2 border-b border-border/20 cursor-pointer group transition-colors',
        isSelected && 'bg-secondary',
        !isSelected && 'hover:bg-secondary/50',
        dragOver && 'bg-primary/10 ring-1 ring-primary/30 ring-inset',
      )}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
    >
      <div className="cursor-grab active:cursor-grabbing text-muted-foreground/40 group-hover:text-muted-foreground flex-shrink-0">
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); if (hasChildren) onToggleCollapse(note.id); }}
        className={cn('flex-shrink-0 w-4 h-4 flex items-center justify-center rounded', hasChildren ? 'text-muted-foreground hover:text-foreground' : 'invisible')}
      >
        {hasChildren && (isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
      </button>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{note.title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{format(new Date(note.updated_at), 'MMM d, yyyy')}</div>
        {note.labels && note.labels.length > 0 && (
          <div className="flex gap-1 mt-1">
            {note.labels.map(l => (
              <span key={l.id} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: l.color + '33', color: l.color }}>{l.name}</span>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-opacity flex-shrink-0"
        title="Delete note"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Template Picker for Notes ──

function NoteTemplatePicker({ templates, onSelect, onClose }: { templates: Template[]; onSelect: (templateId: number) => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[200px] animate-in fade-in-0 zoom-in-95">
        <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">New from Template</div>
        {templates.map(t => (
          <button key={t.id} onClick={() => { onSelect(t.id); onClose(); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors text-left">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />{t.name}
          </button>
        ))}
      </div>
    </>
  );
}

// ── Main Component ──

export function NotesSpace() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [sprintFilter, setSprintFilter] = useState<number | undefined>();
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [listWidth, setListWidth] = useState(288);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const { selectedNoteId, setSelectedNoteId } = useUIStore();

  // Sync from global store (e.g. search modal navigation)
  useEffect(() => {
    if (selectedNoteId !== null) {
      setSelectedId(selectedNoteId);
      setSelectedNoteId(null);
    }
  }, [selectedNoteId, setSelectedNoteId]);

  const { data: notes = [], isLoading } = useNotes({ search: search || undefined, sprint_id: sprintFilter });
  const { data: sprints = [] } = useSprints();
  const { data: selectedNote } = useNote(selectedId);
  const { data: templates = [] } = useTemplates();

  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const reorderNotes = useReorderNotes();
  const createNoteFromTemplate = useCreateNoteFromTemplate();

  const tree = useMemo(() => buildTree(notes), [notes]);
  const flatList = useMemo(() => flattenTree(tree, collapsed), [tree, collapsed]);

  const handleCreate = useCallback(() => {
    createNote.mutate({ title: 'Untitled Note' }, { onSuccess: (note) => setSelectedId(note.id) });
  }, [createNote]);

  const handleCreateFromTemplate = useCallback((templateId: number) => {
    createNoteFromTemplate.mutate({ templateId }, { onSuccess: (note: Note) => setSelectedId(note.id) });
  }, [createNoteFromTemplate]);

  const handleDelete = useCallback((id: number) => {
    if (selectedId === id) setSelectedId(null);
    deleteNote.mutate(id);
  }, [deleteNote, selectedId]);

  const handleToggleCollapse = useCallback((id: number) => {
    setCollapsed(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  // ── Drag & drop for nesting ──
  const handleDragStart = useCallback((e: React.DragEvent, id: number) => {
    e.dataTransfer.setData('text/plain', String(id));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((_e: React.DragEvent, _targetId: number) => {}, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: number) => {
    const sourceId = Number(e.dataTransfer.getData('text/plain'));
    if (!sourceId || sourceId === targetId) return;

    // Prevent circular nesting
    const isDescendant = (parentId: number, childId: number): boolean => {
      const children = notes.filter(n => n.parent_id === parentId);
      for (const child of children) {
        if (child.id === childId) return true;
        if (isDescendant(child.id, childId)) return true;
      }
      return false;
    };
    if (isDescendant(sourceId, targetId)) return;

    const siblings = notes.filter(n => n.parent_id === targetId);
    reorderNotes.mutate([{ id: sourceId, parent_id: targetId, sort_order: siblings.length }]);
  }, [notes, reorderNotes]);

  const handleDropOnRoot = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = Number(e.dataTransfer.getData('text/plain'));
    if (!sourceId) return;
    const rootNotes = notes.filter(n => !n.parent_id);
    reorderNotes.mutate([{ id: sourceId, parent_id: null, sort_order: rootNotes.length }]);
  }, [notes, reorderNotes]);

  // ── Resize handle ──
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startWidth: listWidth };
    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = ev.clientX - resizeRef.current.startX;
      setListWidth(Math.max(200, Math.min(600, resizeRef.current.startWidth + delta)));
    };
    const handleMouseUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [listWidth]);

  return (
    <div className="flex h-full">
      {/* Left: Notes list */}
      <div className="flex-shrink-0 border-r border-border flex flex-col h-full" style={{ width: listWidth }}>
        <div className="px-4 pt-4 pb-2 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Notes</h2>
            <div className="flex items-center gap-1">
              {templates.length > 0 && (
                <div className="relative">
                  <button onClick={() => setTemplatePickerOpen(!templatePickerOpen)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="New from template">
                    <FileText className="h-4 w-4" />
                  </button>
                  {templatePickerOpen && <NoteTemplatePicker templates={templates} onSelect={handleCreateFromTemplate} onClose={() => setTemplatePickerOpen(false)} />}
                </div>
              )}
              <button onClick={handleCreate} className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors" title="New Note">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes..." className="w-full pl-9 pr-3 py-1.5 bg-secondary rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <select value={sprintFilter ?? ''} onChange={e => setSprintFilter(e.target.value ? Number(e.target.value) : undefined)} className="w-full px-2 py-1.5 bg-secondary rounded-md text-sm text-foreground focus:outline-none">
            <option value="">All sprints</option>
            {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto" onDragOver={(e) => e.preventDefault()} onDrop={handleDropOnRoot}>
          {isLoading ? (
            <div className="text-center text-muted-foreground text-sm py-8">Loading...</div>
          ) : flatList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <StickyNote className="h-8 w-8 opacity-30" />
              <span className="text-sm">No notes yet</span>
            </div>
          ) : (
            flatList.map(({ note, depth, hasChildren }) => (
              <NoteTreeItem key={note.id} note={note} depth={depth} hasChildren={hasChildren} isCollapsed={collapsed.has(note.id)} isSelected={selectedId === note.id}
                onSelect={setSelectedId} onDelete={handleDelete} onToggleCollapse={handleToggleCollapse}
                onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop} />
            ))
          )}
        </div>
      </div>

      {/* Resize handle */}
      <div className="w-1 flex-shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors" onMouseDown={handleResizeStart} />

      {/* Right: Note editor */}
      <div className="flex-1 min-w-0 overflow-hidden h-full">
        {!selectedId || !selectedNote ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Select a note or create a new one</div>
        ) : (
          <NoteEditor note={selectedNote} sprints={sprints} onUpdate={(data) => updateNote.mutate({ id: selectedNote.id, data })} onDelete={() => handleDelete(selectedNote.id)} />
        )}
      </div>
    </div>
  );
}

// ── Note Editor ──

function NoteEditor({ note, sprints, onUpdate, onDelete }: { note: Note; sprints: any[]; onUpdate: (data: Record<string, any>) => void; onDelete: () => void }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content || '');
  const [taskSearch, setTaskSearch] = useState('');
  const [showTaskSearch, setShowTaskSearch] = useState(false);

  useEffect(() => { setTitle(note.title); setContent(note.content || ''); }, [note.id, note.title, note.content]);

  const noteLabelIds = new Set(note.labels?.map(l => l.id) || []);

  const { data: linkedTasks = [] } = useNoteLinkedTasks(note.id);
  const addTaskLink = useAddNoteTaskLink();
  const removeTaskLink = useRemoveNoteTaskLink();
  const { data: allTasks = [] } = useTasks({ is_archived: 0 });
  const { openTaskDetail } = useUIStore();

  useEffect(() => {
    if (content === (note.content || '')) return;
    const timer = setTimeout(() => onUpdate({ content }), 800);
    return () => clearTimeout(timer);
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  const linkedTaskIds = new Set(linkedTasks.map((t: any) => t.id));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 mb-3 px-4 pt-3">
        <input value={title} onChange={e => setTitle(e.target.value)} onBlur={() => { if (title !== note.title) onUpdate({ title }); }}
          className="text-xl font-semibold bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-ring rounded px-1 flex-1" placeholder="Note title..." />
        <select value={note.sprint_id ?? ''} onChange={e => onUpdate({ sprint_id: e.target.value ? Number(e.target.value) : null })}
          className="px-2 py-1.5 bg-secondary rounded-md text-sm text-foreground focus:outline-none">
          <option value="">No sprint</option>
          {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button onClick={onDelete} className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive" title="Delete note"><Trash2 className="h-4 w-4" /></button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-3 px-4">
        {(note.labels || []).map(l => (
          <span key={l.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: l.color + '22', color: l.color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} />{l.name}
            <button onClick={() => { const newIds = [...noteLabelIds].filter(id => id !== l.id); onUpdate({ label_ids: newIds }); }} className="ml-0.5 hover:text-destructive" title="Remove label"><X className="h-3 w-3" /></button>
          </span>
        ))}
        <LabelDropdown selectedIds={[...noteLabelIds]} onToggle={(labelId) => {
          const newIds = noteLabelIds.has(labelId) ? [...noteLabelIds].filter(id => id !== labelId) : [...noteLabelIds, labelId];
          onUpdate({ label_ids: newIds });
        }} />
      </div>

      {/* Linked Tasks */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2 px-4">
        {linkedTasks.map((t: any) => (
          <span key={t.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-foreground group cursor-pointer hover:bg-secondary/80"
            onClick={() => openTaskDetail(t.id)}>
            <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.status_color }} />
            <span className="truncate max-w-[200px]">{t.title}</span>
            <button onClick={(e) => { e.stopPropagation(); removeTaskLink.mutate({ noteId: note.id, taskId: t.id }); }} className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-destructive" title="Unlink task"><X className="h-3 w-3" /></button>
          </span>
        ))}
        <div className="relative">
          <button onClick={() => { setShowTaskSearch(!showTaskSearch); setTaskSearch(''); }} className="text-[10px] px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <Link2 className="h-3 w-3 inline mr-0.5" />Link Task
          </button>
          {showTaskSearch && (
            <div className="absolute left-0 top-full mt-1 z-50 w-72">
              <div className="flex items-center gap-1 px-2 h-7 bg-secondary border border-input rounded">
                <Search className="h-3 w-3 text-muted-foreground" />
                <input type="text" autoFocus placeholder="Search task to link..." value={taskSearch} onChange={e => setTaskSearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-foreground focus:outline-none" />
                <button onClick={() => setShowTaskSearch(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
              </div>
              {taskSearch.length >= 1 && (
                <div className="mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {allTasks
                    .filter(t => !linkedTaskIds.has(t.id) && t.title.toLowerCase().includes(taskSearch.toLowerCase()))
                    .slice(0, 8)
                    .map(t => (
                      <button key={t.id} className="w-full text-left px-3 py-1.5 text-sm hover:bg-secondary/60 transition-colors truncate"
                        onClick={() => { addTaskLink.mutate({ noteId: note.id, taskId: t.id }); setTaskSearch(''); setShowTaskSearch(false); }}>
                        <span className="text-muted-foreground mr-1">#{t.id}</span>{t.title}
                      </button>
                    ))}
                  {allTasks.filter(t => !linkedTaskIds.has(t.id) && t.title.toLowerCase().includes(taskSearch.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No tasks found</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full" data-color-mode="dark">
        <MDEditor value={content} onChange={v => setContent(v || '')} height="100%" preview="live" visibleDragbar={false}
          onPaste={(e) => handleEditorPaste(e, content, setContent)} />
      </div>

      <div className="px-4 py-2 text-xs text-muted-foreground">Last updated {format(new Date(note.updated_at), 'MMM d, yyyy h:mm a')}</div>
    </div>
  );
}
