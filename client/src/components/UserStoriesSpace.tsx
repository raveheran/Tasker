import { useState, useCallback, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, X, ChevronRight } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { cn } from '@/lib/utils';
import { handleEditorPaste } from '@/lib/imageUpload';
import {
  useUserStories, useUserStory, useCreateUserStory, useUpdateUserStory, useDeleteUserStory,
  useStatuses, useSprints, useLabels, useTasks,
} from '@/hooks';
import { useUIStore } from '@/store';
import type { UserStory } from '@/types';

export function UserStoriesSpace() {
  const { openTaskDetail, selectedStoryId, setSelectedStoryId } = useUIStore();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [sprintFilter, setSprintFilter] = useState<number | undefined>();

  // Sync from global store (e.g. search modal navigation)
  useEffect(() => {
    if (selectedStoryId !== null) {
      setSelectedId(selectedStoryId);
      setSelectedStoryId(null);
    }
  }, [selectedStoryId, setSelectedStoryId]);

  const { data: stories = [], isLoading } = useUserStories({
    is_archived: 0,
    search: search || undefined,
    sprint_id: sprintFilter,
  });
  const { data: statuses = [] } = useStatuses();
  const { data: sprints = [] } = useSprints();
  const { data: labels = [] } = useLabels();
  const { data: selectedStory } = useUserStory(selectedId);

  const createStory = useCreateUserStory();
  const updateStory = useUpdateUserStory();
  const deleteStory = useDeleteUserStory();

  // Tasks belonging to the selected story
  const { data: storyTasks = [] } = useTasks(
    selectedId ? { is_archived: 0 } : {},
  );
  const filteredTasks = useMemo(
    () => selectedId ? storyTasks.filter(t => t.user_story_id === selectedId) : [],
    [storyTasks, selectedId],
  );

  const handleCreate = useCallback(() => {
    createStory.mutate({ title: 'New User Story' }, {
      onSuccess: (story) => setSelectedId(story.id),
    });
  }, [createStory]);

  const handleDelete = useCallback((id: number) => {
    if (selectedId === id) setSelectedId(null);
    deleteStory.mutate(id);
  }, [deleteStory, selectedId]);

  const statusMap = useMemo(() => new Map(statuses.map(s => [s.id, s])), [statuses]);

  return (
    <div className="flex h-full">
      {/* Left: Story list */}
      <div className="w-80 flex-shrink-0 border-r border-border flex flex-col h-full">
        <div className="px-4 pt-4 pb-2 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">User Stories</h2>
            <button
              onClick={handleCreate}
              className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              title="New Story"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search stories..."
            className="w-full px-3 py-1.5 bg-secondary rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <select
            value={sprintFilter ?? ''}
            onChange={e => setSprintFilter(e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-2 py-1.5 bg-secondary rounded-md text-sm text-foreground focus:outline-none"
          >
            <option value="">All sprints</option>
            {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="text-center text-muted-foreground text-sm py-8">Loading...</div>
          ) : stories.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">No stories yet</div>
          ) : (
            stories.map((story: UserStory) => {
              const status = statusMap.get(story.status_id);
              return (
                <button
                  key={story.id}
                  onClick={() => setSelectedId(story.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-border/30 hover:bg-secondary/50 transition-colors',
                    selectedId === story.id && 'bg-secondary',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: status?.color || '#6b7280' }} />
                    <span className="text-sm font-medium text-foreground truncate flex-1">{story.title}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  </div>
                  <div className="flex items-center gap-2 mt-1 ml-4">
                    <span className="text-xs text-muted-foreground">{status?.name}</span>
                    {story.task_count !== undefined && story.task_count > 0 && (
                      <span className="text-xs text-muted-foreground">· {story.task_count} tasks</span>
                    )}
                  </div>
                  {story.labels && story.labels.length > 0 && (
                    <div className="flex gap-1 mt-1 ml-4">
                      {story.labels.map(l => (
                        <span key={l.id} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: l.color + '33', color: l.color }}>
                          {l.name}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Detail panel */}
      <div className="flex-1 overflow-y-auto">
        {!selectedId || !selectedStory ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a story to view details
          </div>
        ) : (
          <StoryDetail
            story={selectedStory}
            statuses={statuses}
            sprints={sprints}
            labels={labels}
            tasks={filteredTasks}
            onUpdate={(data) => updateStory.mutate({ id: selectedStory.id, data })}
            onDelete={() => handleDelete(selectedStory.id)}
            onClose={() => setSelectedId(null)}
            onOpenTask={openTaskDetail}
          />
        )}
      </div>
    </div>
  );
}

// ── Story Detail ──

function StoryDetail({
  story, statuses, sprints, labels, tasks, onUpdate, onDelete, onClose, onOpenTask,
}: {
  story: UserStory;
  statuses: any[];
  sprints: any[];
  labels: any[];
  tasks: any[];
  onUpdate: (data: Record<string, any>) => void;
  onDelete: () => void;
  onClose: () => void;
  onOpenTask: (id: number) => void;
}) {
  const [title, setTitle] = useState(story.title);
  const [details, setDetails] = useState(story.details || '');

  // Sync when story changes
  const storyId = story.id;
  const [prevId, setPrevId] = useState(storyId);
  if (storyId !== prevId) {
    setPrevId(storyId);
    setTitle(story.title);
    setDetails(story.details || '');
  }

  const storyLabelIds = new Set(story.labels?.map(l => l.id) || []);

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={() => { if (title !== story.title) onUpdate({ title }); }}
          className="text-xl font-semibold bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-ring rounded px-1 flex-1"
        />
        <div className="flex items-center gap-1 ml-4">
          <button onClick={onDelete} className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Status</label>
          <select
            value={story.status_id}
            onChange={e => onUpdate({ status_id: Number(e.target.value) })}
            className="w-full px-2 py-1.5 bg-secondary rounded-md text-sm text-foreground focus:outline-none"
          >
            {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Sprint</label>
          <select
            value={story.sprint_id ?? ''}
            onChange={e => onUpdate({ sprint_id: e.target.value ? Number(e.target.value) : null })}
            className="w-full px-2 py-1.5 bg-secondary rounded-md text-sm text-foreground focus:outline-none"
          >
            <option value="">None</option>
            {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Labels */}
      <div className="mb-6">
        <label className="text-xs text-muted-foreground mb-2 block">Labels</label>
        <div className="flex flex-wrap gap-2">
          {labels.map(l => (
            <button
              key={l.id}
              onClick={() => {
                const newIds = storyLabelIds.has(l.id)
                  ? [...storyLabelIds].filter(id => id !== l.id)
                  : [...storyLabelIds, l.id];
                onUpdate({ label_ids: newIds });
              }}
              className={cn(
                'text-xs px-2 py-1 rounded-full border transition-colors',
                storyLabelIds.has(l.id) ? 'border-transparent' : 'border-border opacity-50 hover:opacity-100',
              )}
              style={{
                backgroundColor: storyLabelIds.has(l.id) ? l.color + '33' : 'transparent',
                color: l.color,
              }}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {/* Details (markdown) */}
      <div className="mb-6">
        <label className="text-xs text-muted-foreground mb-2 block">Details</label>
        <div data-color-mode="dark">
          <MDEditor
            value={details}
            onChange={(v) => setDetails(v || '')}
            onBlur={() => { if (details !== (story.details || '')) onUpdate({ details }); }}
            height={200}
            preview="edit"
            onPaste={(e) => handleEditorPaste(e, details, (v) => setDetails(v))}
          />
        </div>
      </div>

      {/* Tasks belonging to this story */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-2">
          Tasks ({tasks.length})
        </h3>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tasks linked to this story. Set "user_story_id" on tasks to link them.
          </p>
        ) : (
          <div className="space-y-1">
            {tasks.map((t: any) => (
              <button
                key={t.id}
                onClick={() => onOpenTask(t.id)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-secondary text-left text-sm"
              >
                <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.status_color || '#6b7280' }} />
                <span className="truncate text-foreground">{t.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">{t.status_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-muted-foreground">
        Created {format(new Date(story.created_at), 'MMM d, yyyy')}
      </div>
    </div>
  );
}
