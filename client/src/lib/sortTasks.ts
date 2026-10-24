import type { Task } from '@/types';
import type { SortField, SortDir } from '@/store';

export function sortTasks(tasks: Task[], field: SortField, dir: SortDir): Task[] {
  const multiplier = dir === 'desc' ? -1 : 1;
  return [...tasks].sort((a, b) => {
    // Priority tasks always come first, regardless of sort direction
    const aPri = a.is_priority ? 1 : 0;
    const bPri = b.is_priority ? 1 : 0;
    if (aPri !== bPri) return bPri - aPri;

    let cmp = 0;
    switch (field) {
      case 'title':
        cmp = a.title.localeCompare(b.title);
        break;
      case 'do_date':
        cmp = (a.do_date ?? '').localeCompare(b.do_date ?? '');
        break;
      case 'sprint':
        cmp = (a.sprint_id ?? 0) - (b.sprint_id ?? 0);
        break;
      case 'label':
        cmp = (a.labels[0]?.name ?? '').localeCompare(b.labels[0]?.name ?? '');
        break;
      case 'created_at':
      default:
        cmp = a.created_at.localeCompare(b.created_at);
        break;
    }
    return cmp * multiplier;
  });
}
