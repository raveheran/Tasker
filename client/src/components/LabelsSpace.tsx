import { useState } from 'react';
import { Tag, ListTodo, BookOpen, StickyNote, ChevronDown, ChevronRight, X } from 'lucide-react';
import { useLabels, useSearch } from '@/hooks';
import { useUIStore } from '@/store';
import { cn } from '@/lib/utils';

export function LabelsSpace() {
  const { data: labels = [] } = useLabels();
  const [selectedLabelIds, setSelectedLabelIds] = useState<number[]>([]);
  const { data: results, isLoading } = useSearch('', selectedLabelIds.length > 0 ? selectedLabelIds : undefined);
  const { openTaskDetail, setActiveSpace, setSelectedNoteId, setSelectedStoryId } = useUIStore();

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    tasks: true,
    stories: true,
    notes: true,
  });

  function toggleLabel(id: number) {
    setSelectedLabelIds(prev =>
      prev.includes(id) ? prev.filter(lid => lid !== id) : [...prev, id]
    );
  }

  function clearLabels() {
    setSelectedLabelIds([]);
  }

  function toggleSection(key: string) {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function handleTaskClick(taskId: number) {
    openTaskDetail(taskId);
  }

  function handleStoryClick(storyId: number) {
    setActiveSpace('user-stories');
    setSelectedStoryId(storyId);
  }

  function handleNoteClick(noteId: number) {
    setActiveSpace('notes');
    setSelectedNoteId(noteId);
  }

  const hasResults = results && (results.tasks.length > 0 || results.userStories.length > 0 || results.notes.length > 0);
  const totalCount = results ? results.tasks.length + results.userStories.length + results.notes.length : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Tag className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Label View</h2>
        {selectedLabelIds.length > 0 && (
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {totalCount} item{totalCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Label selector */}
      <div className="px-4 py-3 border-b border-border">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Select labels to filter
        </div>
        <div className="flex flex-wrap gap-2">
          {labels.map(label => {
            const isActive = selectedLabelIds.includes(label.id);
            return (
              <button
                key={label.id}
                onClick={() => toggleLabel(label.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                  isActive
                    ? 'text-white shadow-sm scale-105'
                    : 'bg-secondary text-foreground border-border hover:border-primary/50 hover:scale-102'
                )}
                style={isActive ? { backgroundColor: label.color, borderColor: label.color } : undefined}
              >
                <span
                  className={cn('w-2 h-2 rounded-full', isActive ? 'bg-white/60' : '')}
                  style={!isActive ? { backgroundColor: label.color } : undefined}
                />
                {label.name}
                {isActive && <X className="h-3 w-3 ml-0.5 opacity-80" />}
              </button>
            );
          })}
          {labels.length === 0 && (
            <span className="text-sm text-muted-foreground">No labels created yet. Create labels from the Settings or Task detail.</span>
          )}
        </div>
        {selectedLabelIds.length > 0 && (
          <button
            onClick={clearLabels}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {selectedLabelIds.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
            <Tag className="h-8 w-8 opacity-40" />
            <p className="text-sm">Select one or more labels above to see related items</p>
          </div>
        )}

        {selectedLabelIds.length > 0 && isLoading && (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            Loading…
          </div>
        )}

        {selectedLabelIds.length > 0 && !isLoading && !hasResults && (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
            <p className="text-sm">No items found with the selected label{selectedLabelIds.length > 1 ? 's' : ''}</p>
          </div>
        )}

        {hasResults && (
          <div className="py-2">
            {/* Tasks section */}
            {results!.tasks.length > 0 && (
              <CollapsibleSection
                icon={ListTodo}
                label="Tasks"
                count={results!.tasks.length}
                expanded={expandedSections.tasks}
                onToggle={() => toggleSection('tasks')}
              >
                <div className="divide-y divide-border/50">
                  {results!.tasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => handleTaskClick(task.id)}
                      className="w-full flex items-center gap-3 px-6 py-2.5 hover:bg-secondary/50 transition-colors text-left"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: task.status_color }}
                      />
                      <span className="text-sm text-foreground truncate flex-1">{task.title}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{task.status_name}</span>
                      {task.do_date && (
                        <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                          {new Date(task.do_date).toLocaleDateString()}
                        </span>
                      )}
                      {task.is_archived === 1 && (
                        <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">archived</span>
                      )}
                    </button>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* User Stories section */}
            {results!.userStories.length > 0 && (
              <CollapsibleSection
                icon={BookOpen}
                label="User Stories"
                count={results!.userStories.length}
                expanded={expandedSections.stories}
                onToggle={() => toggleSection('stories')}
              >
                <div className="divide-y divide-border/50">
                  {results!.userStories.map(story => (
                    <button
                      key={story.id}
                      onClick={() => handleStoryClick(story.id)}
                      className="w-full flex items-center gap-3 px-6 py-2.5 hover:bg-secondary/50 transition-colors text-left"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: story.status_color }}
                      />
                      <span className="text-sm text-foreground truncate flex-1">{story.title}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{story.status_name}</span>
                      {story.is_archived === 1 && (
                        <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">archived</span>
                      )}
                    </button>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Notes section */}
            {results!.notes.length > 0 && (
              <CollapsibleSection
                icon={StickyNote}
                label="Notes"
                count={results!.notes.length}
                expanded={expandedSections.notes}
                onToggle={() => toggleSection('notes')}
              >
                <div className="divide-y divide-border/50">
                  {results!.notes.map(note => (
                    <button
                      key={note.id}
                      onClick={() => handleNoteClick(note.id)}
                      className="w-full flex items-center gap-3 px-6 py-2.5 hover:bg-secondary/50 transition-colors text-left"
                    >
                      <StickyNote className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-foreground truncate flex-1">{note.title}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {new Date(note.updated_at).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              </CollapsibleSection>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CollapsibleSection({
  icon: Icon,
  label,
  count,
  expanded,
  onToggle,
  children,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2 hover:bg-secondary/30 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full ml-1">
          {count}
        </span>
      </button>
      {expanded && children}
    </div>
  );
}
