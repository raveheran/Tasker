import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useCreateTask } from '@/hooks';
import { useUIStore } from '@/store';

export function QuickAdd() {
  const { quickAddOpen, setQuickAddOpen } = useUIStore();
  const [title, setTitle] = useState('');
  const createTask = useCreateTask();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    createTask.mutate({ title: trimmed });
    setTitle('');
  };

  if (!quickAddOpen) {
    return (
      <button
        onClick={() => setQuickAddOpen(true)}
        className="fixed bottom-6 right-6 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-50"
      >
        <Plus className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 bg-card border border-border rounded-lg shadow-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-foreground">Quick Add Task</span>
        <button onClick={() => setQuickAddOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          autoFocus
          type="text"
          placeholder="Task title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 h-9 px-3 bg-secondary text-foreground text-sm rounded-md border border-input focus:outline-none focus:ring-1 focus:ring-ring"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuickAddOpen(false);
          }}
        />
        <button
          type="submit"
          disabled={!title.trim() || createTask.isPending}
          className="h-9 px-4 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          Add
        </button>
      </form>
    </div>
  );
}
