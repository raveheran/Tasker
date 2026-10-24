import type { SpaceName } from '@/types';

export function PlaceholderPage({ space }: { space: SpaceName }) {
  const labels: Record<string, string> = {
    dashboard: 'Dashboard',
    backlog: 'Backlog',
    'my-day': 'My Day',
    'user-stories': 'User Stories',
    notes: 'Notes',
    archive: 'Archive',
    'sprint-overview': 'Sprint Overview',
    templates: 'Templates',
  };

  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      <div className="text-center">
        <h2 className="text-lg font-medium text-foreground mb-2">{labels[space] ?? space}</h2>
        <p className="text-sm">Coming in a future phase.</p>
      </div>
    </div>
  );
}
