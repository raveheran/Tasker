import { useState } from 'react';
import { useTasks, useUpdateTask, useDeleteTask, useUserStories, useUpdateUserStory } from '@/hooks';
import { useUIStore } from '@/store';
import { ArchiveRestore, Trash2, Search, ListTodo, BookOpen } from 'lucide-react';

type ArchiveTab = 'tasks' | 'stories';

export function ArchiveSpace() {
  const [tab, setTab] = useState<ArchiveTab>('tasks');
  const [search, setSearch] = useState('');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-foreground">Archive</h1>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4">
          <div className="flex bg-secondary rounded-md p-0.5">
            <button
              onClick={() => setTab('tasks')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                tab === 'tasks' ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ListTodo className="h-3.5 w-3.5" />
              Tasks
            </button>
            <button
              onClick={() => setTab('stories')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                tab === 'stories' ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Stories
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 bg-secondary rounded-md px-3 py-1.5 flex-1 max-w-xs">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter archived items…"
              className="bg-transparent text-sm text-foreground outline-none flex-1 placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'tasks' ? (
          <ArchivedTasks search={search} />
        ) : (
          <ArchivedStories search={search} />
        )}
      </div>
    </div>
  );
}

function ArchivedTasks({ search }: { search: string }) {
  const { data: tasks, isLoading } = useTasks({ is_archived: 1, search: search || undefined });
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const openTaskDetail = useUIStore((s) => s.openTaskDetail);

  if (isLoading) return <div className="text-muted-foreground text-sm">Loading…</div>;
  if (!tasks || tasks.length === 0) {
    return <div className="text-muted-foreground text-sm text-center py-12">No archived tasks</div>;
  }

  return (
    <div className="space-y-1">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex items-center gap-3 px-4 py-3 rounded-md bg-card border border-border hover:border-primary/30 transition-colors group"
        >
          <button
            onClick={() => openTaskDetail(task.id)}
            className="flex-1 text-left min-w-0"
          >
            <div className="text-sm text-foreground truncate">{task.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Archived • Created {new Date(task.created_at).toLocaleDateString()}
            </div>
          </button>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => updateTask.mutate({ id: task.id, data: { is_archived: 0 } })}
              className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Restore"
            >
              <ArchiveRestore className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                if (confirm('Permanently delete this task?')) {
                  deleteTask.mutate(task.id);
                }
              }}
              className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
              title="Delete permanently"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ArchivedStories({ search }: { search: string }) {
  const { data: stories, isLoading } = useUserStories({ is_archived: 1, search: search || undefined });
  const updateStory = useUpdateUserStory();
  const { setActiveSpace } = useUIStore();

  if (isLoading) return <div className="text-muted-foreground text-sm">Loading…</div>;
  if (!stories || stories.length === 0) {
    return <div className="text-muted-foreground text-sm text-center py-12">No archived user stories</div>;
  }

  return (
    <div className="space-y-1">
      {stories.map((story) => (
        <div
          key={story.id}
          className="flex items-center gap-3 px-4 py-3 rounded-md bg-card border border-border hover:border-primary/30 transition-colors group"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm text-foreground truncate">{story.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Archived • {story.task_count ?? 0} tasks
            </div>
          </div>

          <button
            onClick={() => {
              updateStory.mutate({ id: story.id, data: { is_archived: 0 } });
              setActiveSpace('user-stories');
            }}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
            title="Restore"
          >
            <ArchiveRestore className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
