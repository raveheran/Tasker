import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Plus, Trash2, GripVertical, Check, ArrowRight, Link2, Search, Copy, FileText } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { cn } from '@/lib/utils';
import { handleEditorPaste } from '@/lib/imageUpload';
import {
  useTask, useStatuses, useSprints, useUpdateTask, useAddSubtask, useUpdateSubtask, useDeleteSubtask, useDeleteTask,
  useCreateSprint, useDuplicateTask, useUserStory, useTemplates,
  useTasks, useTaskDependencies, useTaskDependents, useAddDependency, useRemoveDependency,
  useTaskRelations, useAddRelation, useRemoveRelation, useActivityLog,
  useNotes, useTaskLinkedNotes, useAddTaskNoteLink, useRemoveTaskNoteLink,
} from '@/hooks';
import { useUIStore } from '@/store';
import type { Subtask, LinkedTask, LinkedNote } from '@/types';
import { LabelDropdown } from './LabelDropdown';

const MIN_DETAIL_WIDTH = 360;

export function TaskDetail() {
  const { selectedTaskId, taskDetailOpen, closeTaskDetail, openTaskDetail, taskDetailWidth, setTaskDetailWidth } = useUIStore();
  const { data: task } = useTask(selectedTaskId);
  const { data: statuses = [] } = useStatuses();
  const { data: sprints = [] } = useSprints();
  const updateTask = useUpdateTask();
  const addSubtask = useAddSubtask();
  const updateSubtask = useUpdateSubtask();
  const deleteSubtask = useDeleteSubtask();
  const deleteTask = useDeleteTask();
  const duplicateTask = useDuplicateTask();
  const createSprint = useCreateSprint();

  // Dependencies & Relations
  const { data: dependencies = [] } = useTaskDependencies(selectedTaskId);
  const { data: dependents = [] } = useTaskDependents(selectedTaskId);
  const { data: relations = [] } = useTaskRelations(selectedTaskId);
  const addDependency = useAddDependency();
  const removeDependency = useRemoveDependency();
  const addRelation = useAddRelation();
  const removeRelation = useRemoveRelation();
  const { data: allTasks = [] } = useTasks({ is_archived: 0 });
  const { data: taskActivity = [] } = useActivityLog({ entity_type: 'task', entity_id: selectedTaskId ?? undefined, limit: 20 });
  const { data: parentStory } = useUserStory(task?.user_story_id ?? null);
  const { data: templates = [] } = useTemplates();

  // Task-Note links
  const { data: linkedNotes = [] } = useTaskLinkedNotes(selectedTaskId ?? 0);
  const addNoteLink = useAddTaskNoteLink();
  const removeNoteLink = useRemoveTaskNoteLink();
  const { data: allNotes = [] } = useNotes();

  const [title, setTitle] = useState('');
  const [details, setDetails] = useState<string | undefined>('');
  const [newSubtask, setNewSubtask] = useState('');
  const [linkSearch, setLinkSearch] = useState('');
  const [linkMode, setLinkMode] = useState<'dependency' | 'relation' | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const resizingRef = useRef(false);

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!resizingRef.current) return;
      const newWidth = Math.min(
        window.innerWidth,
        Math.max(MIN_DETAIL_WIDTH, window.innerWidth - e.clientX),
      );
      setTaskDetailWidth(newWidth);
    };
    const handleUp = () => {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      setIsResizing(false);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [setTaskDetailWidth]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDetails(task.details ?? '');
    }
  }, [task]);

  if (!taskDetailOpen || !task) return null;

  const handleSaveTitle = () => {
    if (title.trim() && title !== task.title) {
      updateTask.mutate({ id: task.id, data: { title: title.trim() } });
    }
  };

  const handleSaveDetails = () => {
    if (details !== task.details) {
      updateTask.mutate({ id: task.id, data: { details: details || null } });
    }
  };

  const handleFieldChange = (field: string, value: unknown) => {
    updateTask.mutate({ id: task.id, data: { [field]: value } });
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    addSubtask.mutate({ taskId: task.id, title: newSubtask.trim() });
    setNewSubtask('');
  };

  const handleToggleSubtask = (sub: Subtask) => {
    updateSubtask.mutate({
      taskId: task.id,
      subtaskId: sub.id,
      data: { is_completed: sub.is_completed ? 0 : 1 },
    });
  };

  const handleDelete = () => {
    if (confirm('Delete this task?')) {
      deleteTask.mutate(task.id);
      closeTaskDetail();
    }
  };

  const handleArchive = () => {
    updateTask.mutate({ id: task.id, data: { is_archived: 1 } });
    closeTaskDetail();
  };

  // Label toggle
  const currentLabelIds = task.labels.map((l) => l.id);
  const handleToggleLabel = (labelId: number) => {
    const newIds = currentLabelIds.includes(labelId)
      ? currentLabelIds.filter((id) => id !== labelId)
      : [...currentLabelIds, labelId];
    updateTask.mutate({ id: task.id, data: { label_ids: newIds } });
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={closeTaskDetail} />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full max-w-full bg-card border-l border-border z-50 flex flex-col shadow-2xl"
        style={{ width: taskDetailWidth }}
      >
        {/* Resize handle (left edge) */}
        <div
          onPointerDown={handleResizeStart}
          className={cn(
            'group absolute left-0 top-0 h-full w-3 -ml-1.5 cursor-ew-resize z-10 flex items-center justify-center',
          )}
          title="Drag to resize"
        >
          {/* Visible grip bar */}
          <div
            className={cn(
              'h-16 w-1 rounded-full transition-colors',
              isResizing ? 'bg-primary' : 'bg-border group-hover:bg-primary/70',
            )}
          />
        </div>
        {isResizing && <div className="fixed inset-0 z-[60] cursor-ew-resize select-none" />}

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {parentStory && (
              <>
                <span className="hover:text-foreground cursor-default" title={parentStory.title}>
                  📖 {parentStory.title.length > 30 ? parentStory.title.slice(0, 30) + '…' : parentStory.title}
                </span>
                <span>/</span>
              </>
            )}
            <span>Task #{task.id}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleArchive} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary">
              Archive
            </button>
            <button
              onClick={() => { duplicateTask.mutate(task.id, { onSuccess: (newTask: any) => openTaskDetail(newTask.id) }); }}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary"
              title="Duplicate task"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button onClick={handleDelete} className="text-xs text-destructive hover:text-destructive/80 px-2 py-1 rounded hover:bg-secondary">
              Delete
            </button>
            <button onClick={closeTaskDetail} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Title */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
            className="w-full text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0 text-foreground"
          />

          {/* Fields grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Status */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <select
                value={task.status_id}
                onChange={(e) => handleFieldChange('status_id', Number(e.target.value))}
                className="w-full h-8 px-2 bg-secondary text-sm rounded-md border border-input font-medium"
                style={{ color: statuses.find(s => s.id === task.status_id)?.color }}
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id} style={{ color: s.color }}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Sprint */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Sprint</label>
              <select
                value={task.sprint_id ?? ''}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    const name = prompt('New sprint name:');
                    if (name?.trim()) {
                      createSprint.mutate({ name: name.trim() }, {
                        onSuccess: (s) => handleFieldChange('sprint_id', s.id),
                      });
                    }
                  } else {
                    handleFieldChange('sprint_id', e.target.value ? Number(e.target.value) : null);
                  }
                }}
                className="w-full h-8 px-2 bg-secondary text-foreground text-sm rounded-md border border-input"
              >
                <option value="">None</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                <option value="__new__">+ New sprint…</option>
              </select>
            </div>

            {/* Do Date */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Do Date</label>
              <input
                type="date"
                value={task.do_date ?? ''}
                onChange={(e) => handleFieldChange('do_date', e.target.value || null)}
                className="w-full h-8 px-2 bg-secondary text-foreground text-sm rounded-md border border-input"
              />
            </div>

            {/* Effort */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Effort (days)</label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={task.effort_estimate ?? ''}
                onChange={(e) => handleFieldChange('effort_estimate', e.target.value ? Number(e.target.value) : null)}
                className="w-full h-8 px-2 bg-secondary text-foreground text-sm rounded-md border border-input"
              />
            </div>

            {/* Start Date */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Start Date</label>
              <input
                type="date"
                value={task.start_date ?? ''}
                onChange={(e) => handleFieldChange('start_date', e.target.value || null)}
                className="w-full h-8 px-2 bg-secondary text-foreground text-sm rounded-md border border-input"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">End Date</label>
              <input
                type="date"
                value={task.end_date ?? ''}
                onChange={(e) => handleFieldChange('end_date', e.target.value || null)}
                className="w-full h-8 px-2 bg-secondary text-foreground text-sm rounded-md border border-input"
              />
            </div>
          </div>

          {/* Flags */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!task.requires_other}
                onChange={(e) => handleFieldChange('requires_other', e.target.checked ? 1 : 0)}
                className="rounded border-input"
              />
              <label className="text-sm text-muted-foreground">Requires other</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!task.is_quick}
                onChange={(e) => handleFieldChange('is_quick', e.target.checked ? 1 : 0)}
                className="rounded border-input"
              />
              <label className="text-sm text-muted-foreground">⚡️ Quick task</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!task.is_priority}
                onChange={(e) => handleFieldChange('is_priority', e.target.checked ? 1 : 0)}
                className="rounded border-input"
              />
              <label className="text-sm text-muted-foreground">❗️ Priority</label>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">🔁 Repeat</label>
              <select
                value={task.recurrence_rule ?? ''}
                onChange={(e) => handleFieldChange('recurrence_rule', e.target.value || null)}
                className="h-7 px-1.5 bg-secondary text-foreground text-xs rounded border border-input"
              >
                <option value="">None</option>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          {task.requires_other ? (
            <input
              type="text"
              placeholder="Who / what is needed?"
              value={task.requires_other_note ?? ''}
              onChange={(e) => handleFieldChange('requires_other_note', e.target.value || null)}
              className="w-full h-8 px-2 bg-secondary text-foreground text-sm rounded-md border border-input"
            />
          ) : null}

          {/* Labels */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Labels</label>
            {task.labels.length > 0 && (
              <div className="flex gap-1 flex-wrap mb-2">
                {task.labels.map((l) => (
                  <span key={l.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: l.color + '22', color: l.color }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                    {l.name}
                    <button
                      onClick={() => handleToggleLabel(l.id)}
                      className="ml-0.5 hover:text-destructive"
                      title="Remove from task"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <LabelDropdown
              selectedIds={currentLabelIds}
              onToggle={handleToggleLabel}
            />
          </div>

          {/* Details (Markdown) */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs text-muted-foreground">Details</label>
              {templates.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    const tmpl = templates.find(t => t.id === Number(e.target.value));
                    if (tmpl?.details_content) {
                      const appended = (details || '') + (details ? '\n\n' : '') + tmpl.details_content;
                      setDetails(appended);
                      updateTask.mutate({ id: task.id, data: { details: appended } });
                    }
                  }}
                  className="h-6 px-1.5 bg-secondary text-foreground text-[11px] rounded border border-input focus:outline-none"
                >
                  <option value="">Apply template…</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div data-color-mode="dark">
              <MDEditor
                value={details}
                onChange={setDetails}
                onBlur={handleSaveDetails}
                height={250}
                preview="edit"
                hideToolbar={false}
                onPaste={(e) => handleEditorPaste(e, details || '', (v) => setDetails(v))}
              />
            </div>
          </div>

          {/* Dependencies & Relations */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-muted-foreground">Dependencies & Links</label>
              <div className="flex gap-1">
                <button
                  onClick={() => { setLinkMode(linkMode === 'dependency' ? null : 'dependency'); setLinkSearch(''); }}
                  className={cn('text-[10px] px-1.5 py-0.5 rounded transition-colors', linkMode === 'dependency' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary')}
                >
                  <ArrowRight className="h-3 w-3 inline mr-0.5" />Blocked by
                </button>
                <button
                  onClick={() => { setLinkMode(linkMode === 'relation' ? null : 'relation'); setLinkSearch(''); }}
                  className={cn('text-[10px] px-1.5 py-0.5 rounded transition-colors', linkMode === 'relation' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary')}
                >
                  <Link2 className="h-3 w-3 inline mr-0.5" />Link
                </button>
              </div>
            </div>

            {/* Link search */}
            {linkMode && (
              <div className="mb-2 relative">
                <div className="flex items-center gap-1 px-2 h-7 bg-secondary border border-input rounded">
                  <Search className="h-3 w-3 text-muted-foreground" />
                  <input
                    type="text"
                    autoFocus
                    placeholder={linkMode === 'dependency' ? 'Search task to add as blocker...' : 'Search task or note to link...'}
                    value={linkSearch}
                    onChange={(e) => setLinkSearch(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-foreground focus:outline-none"
                  />
                  <button onClick={() => setLinkMode(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
                {linkSearch.length >= 1 && (() => {
                  const linkedNoteIds = new Set(linkedNotes.map((n: LinkedNote) => n.id));
                  const matchingTasks = allTasks.filter(t => t.id !== task.id && t.title.toLowerCase().includes(linkSearch.toLowerCase())).slice(0, 8);
                  const matchingNotes = linkMode === 'relation'
                    ? allNotes.filter((n: any) => !linkedNoteIds.has(n.id) && n.title.toLowerCase().includes(linkSearch.toLowerCase())).slice(0, 8)
                    : [];
                  const hasResults = matchingTasks.length > 0 || matchingNotes.length > 0;
                  return (
                    <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {matchingTasks.map(t => (
                        <button
                          key={`task-${t.id}`}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-secondary/60 transition-colors truncate"
                          onClick={() => {
                            if (linkMode === 'dependency') {
                              addDependency.mutate({ taskId: task.id, dependsOnTaskId: t.id });
                            } else {
                              addRelation.mutate({ taskId: task.id, relatedTaskId: t.id });
                            }
                            setLinkSearch('');
                            setLinkMode(null);
                          }}
                        >
                          <span className="text-muted-foreground mr-1">#{t.id}</span>
                          {t.title}
                        </button>
                      ))}
                      {matchingNotes.length > 0 && matchingTasks.length > 0 && (
                        <div className="px-3 py-1 text-[10px] text-muted-foreground/60 uppercase tracking-wide border-t border-border">Notes</div>
                      )}
                      {matchingNotes.map((n: any) => (
                        <button
                          key={`note-${n.id}`}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-secondary/60 transition-colors truncate"
                          onClick={() => {
                            addNoteLink.mutate({ taskId: task.id, noteId: n.id });
                            setLinkSearch('');
                            setLinkMode(null);
                          }}
                        >
                          <FileText className="h-3 w-3 inline mr-1 text-muted-foreground" />
                          {n.title}
                        </button>
                      ))}
                      {!hasResults && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No results found</div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Blocked by list */}
            {dependencies.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Blocked by</div>
                {dependencies.map((dep: LinkedTask) => (
                  <div key={dep.id} className="flex items-center gap-2 group py-0.5">
                    <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: dep.status_color }} />
                    <button
                      className="text-sm text-foreground hover:text-primary truncate flex-1 text-left"
                      onClick={() => openTaskDetail(dep.id)}
                    >
                      <span className="text-muted-foreground mr-1">#{dep.id}</span>{dep.title}
                    </button>
                    <span className="text-[10px] text-muted-foreground">{dep.status_name}</span>
                    <button
                      onClick={() => removeDependency.mutate({ taskId: task.id, dependsOnTaskId: dep.id })}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Blocks list */}
            {dependents.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Blocks</div>
                {dependents.map((dep: LinkedTask) => (
                  <div key={dep.id} className="flex items-center gap-2 py-0.5">
                    <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: dep.status_color }} />
                    <button
                      className="text-sm text-foreground hover:text-primary truncate flex-1 text-left"
                      onClick={() => openTaskDetail(dep.id)}
                    >
                      <span className="text-muted-foreground mr-1">#{dep.id}</span>{dep.title}
                    </button>
                    <span className="text-[10px] text-muted-foreground">{dep.status_name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Related tasks */}
            {relations.length > 0 && (
              <div>
                <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Related</div>
                {relations.map((rel: LinkedTask) => (
                  <div key={rel.id} className="flex items-center gap-2 group py-0.5">
                    <Link2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <button
                      className="text-sm text-foreground hover:text-primary truncate flex-1 text-left"
                      onClick={() => openTaskDetail(rel.id)}
                    >
                      <span className="text-muted-foreground mr-1">#{rel.id}</span>{rel.title}
                    </button>
                    <span className="text-[10px] text-muted-foreground">{rel.status_name}</span>
                    <button
                      onClick={() => removeRelation.mutate({ taskId: task.id, relatedTaskId: rel.id })}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Linked Notes */}
            {linkedNotes.length > 0 && (
              <div>
                <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Linked Notes</div>
                {linkedNotes.map((note: LinkedNote) => (
                  <div key={note.id} className="flex items-center gap-2 group py-0.5">
                    <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <button
                      className="text-sm text-foreground hover:text-primary truncate flex-1 text-left"
                      onClick={() => {
                        const { setActiveSpace, setSelectedNoteId } = useUIStore.getState();
                        setSelectedNoteId(note.id);
                        setActiveSpace('notes');
                        closeTaskDetail();
                      }}
                    >
                      {note.title}
                    </button>
                    <button
                      onClick={() => removeNoteLink.mutate({ taskId: task.id, noteId: note.id })}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {dependencies.length === 0 && dependents.length === 0 && relations.length === 0 && linkedNotes.length === 0 && !linkMode && (
              <div className="text-xs text-muted-foreground/50 italic">No dependencies or links</div>
            )}
          </div>

          {/* Subtasks */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">
              Subtasks ({task.subtasks.filter((s) => s.is_completed).length}/{task.subtasks.length})
            </label>
            <div className="space-y-1">
              {task.subtasks.map((sub) => (
                <div key={sub.id} className="flex items-center gap-2 group">
                  <GripVertical className="h-3 w-3 text-muted-foreground/30 cursor-grab" />
                  <button
                    onClick={() => handleToggleSubtask(sub)}
                    className={cn(
                      'h-4 w-4 rounded border flex items-center justify-center flex-shrink-0',
                      sub.is_completed
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-input hover:border-primary'
                    )}
                  >
                    {sub.is_completed ? <Check className="h-3 w-3" /> : null}
                  </button>
                  <span className={cn('text-sm flex-1', sub.is_completed && 'line-through text-muted-foreground')}>
                    {sub.title}
                  </span>
                  <button
                    onClick={() => deleteSubtask.mutate({ taskId: task.id, subtaskId: sub.id })}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddSubtask} className="mt-2 flex gap-2">
              <input
                type="text"
                placeholder="Add subtask..."
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                className="flex-1 h-7 px-2 bg-secondary text-foreground text-sm rounded border border-input focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button type="submit" className="text-muted-foreground hover:text-foreground">
                <Plus className="h-4 w-4" />
              </button>
            </form>
          </div>

          {/* Activity History */}
          {taskActivity.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Activity</label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {taskActivity.map((entry) => (
                  <div key={entry.id} className="text-xs text-muted-foreground flex gap-2">
                    <span className="whitespace-nowrap">{new Date(entry.created_at + 'Z').toLocaleString()}</span>
                    <span className="text-foreground/70 truncate">{entry.details || entry.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
