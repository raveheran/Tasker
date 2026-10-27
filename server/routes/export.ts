import { Router, Request, Response } from 'express';
import { getDb, currentWorkspace } from '../db';

const router = Router();

// Filename-safe slug of the active workspace's name, so exports from different workspaces are distinguishable
function workspaceSlug(): string {
  return currentWorkspace().name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'workspace';
}

// GET export all data as JSON
router.get('/json', (_req: Request, res: Response) => {
  const db = getDb();

  const data = {
    exported_at: new Date().toISOString(),
    statuses: db.prepare('SELECT * FROM statuses ORDER BY sort_order').all(),
    sprints: db.prepare('SELECT * FROM sprints ORDER BY created_at DESC').all(),
    labels: db.prepare('SELECT * FROM labels ORDER BY name').all(),
    templates: db.prepare('SELECT * FROM templates ORDER BY name').all(),
    user_stories: db.prepare('SELECT * FROM user_stories ORDER BY created_at DESC').all(),
    user_story_labels: db.prepare('SELECT * FROM user_story_labels').all(),
    tasks: db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all(),
    task_labels: db.prepare('SELECT * FROM task_labels').all(),
    subtasks: db.prepare('SELECT * FROM subtasks ORDER BY task_id, sort_order').all(),
    notes: db.prepare('SELECT * FROM notes ORDER BY created_at DESC').all(),
    note_labels: db.prepare('SELECT * FROM note_labels').all(),
    task_dependencies: db.prepare('SELECT * FROM task_dependencies').all(),
    task_relations: db.prepare('SELECT * FROM task_relations').all(),
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="tasker-${workspaceSlug()}-export-${new Date().toISOString().split('T')[0]}.json"`);
  res.json(data);
});

// GET export tasks as CSV
router.get('/tasks-csv', (req: Request, res: Response) => {
  const db = getDb();
  const includeArchived = req.query.include_archived === 'true';

  const tasks = db.prepare(`
    SELECT t.id, t.title, s.name as status, s.phase,
      sp.name as sprint, t.do_date, t.start_date, t.end_date,
      t.effort_estimate, t.is_archived, t.requires_other,
      t.created_at, t.updated_at,
      us.title as user_story
    FROM tasks t
    LEFT JOIN statuses s ON t.status_id = s.id
    LEFT JOIN sprints sp ON t.sprint_id = sp.id
    LEFT JOIN user_stories us ON t.user_story_id = us.id
    ${includeArchived ? '' : 'WHERE t.is_archived = 0'}
    ORDER BY t.created_at DESC
  `).all() as any[];

  const headers = ['ID', 'Title', 'Status', 'Phase', 'Sprint', 'Do Date', 'Start Date', 'End Date', 'Effort', 'Archived', 'Requires Other', 'User Story', 'Created', 'Updated'];
  const rows = tasks.map(t => [
    t.id,
    csvEscape(t.title),
    csvEscape(t.status || ''),
    csvEscape(t.phase || ''),
    csvEscape(t.sprint || ''),
    t.do_date || '',
    t.start_date || '',
    t.end_date || '',
    t.effort_estimate ?? '',
    t.is_archived,
    t.requires_other,
    csvEscape(t.user_story || ''),
    t.created_at,
    t.updated_at,
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="tasker-${workspaceSlug()}-tasks-${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(csv);
});

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export default router;
