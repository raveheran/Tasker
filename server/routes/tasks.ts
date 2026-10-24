import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { logActivity } from './activity';
import type Database from 'better-sqlite3';

const router = Router();

// Recurrence helper: compute next do_date based on rule
function getNextDate(currentDate: string | null, rule: string): string {
  const base = currentDate ? new Date(currentDate) : new Date();
  switch (rule) {
    case 'daily': base.setDate(base.getDate() + 1); break;
    case 'weekdays': {
      do { base.setDate(base.getDate() + 1); } while (base.getDay() === 0 || base.getDay() === 6);
      break;
    }
    case 'weekly': base.setDate(base.getDate() + 7); break;
    case 'biweekly': base.setDate(base.getDate() + 14); break;
    case 'monthly': base.setMonth(base.getMonth() + 1); break;
    default: base.setDate(base.getDate() + 1);
  }
  return base.toISOString().slice(0, 10);
}

function createNextRecurrence(db: Database.Database, task: any) {
  const backlogStatus = db.prepare('SELECT id FROM statuses WHERE name = ?').get('Backlog') as any;
  const nextDate = getNextDate(task.do_date, task.recurrence_rule);
  const parentId = task.recurrence_parent_id || task.id;

  const result = db.prepare(`
    INSERT INTO tasks (title, status_id, user_story_id, do_date, sprint_id, effort_estimate,
      details, requires_other, requires_other_note, color_override, is_quick, is_priority,
      recurrence_rule, recurrence_parent_id, template_origin_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    task.title, backlogStatus?.id || task.status_id, task.user_story_id, nextDate,
    task.sprint_id, task.effort_estimate, task.details,
    task.requires_other, task.requires_other_note, task.color_override, task.is_quick,
    task.is_priority || 0,
    task.recurrence_rule, parentId, task.template_origin_id
  );

  const newId = Number(result.lastInsertRowid);

  // Copy labels
  const labels = db.prepare('SELECT label_id FROM task_labels WHERE task_id = ?').all(task.id) as any[];
  const insLabel = db.prepare('INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?, ?)');
  labels.forEach(l => insLabel.run(newId, l.label_id));

  logActivity('task', newId, 'created', `Auto-created recurring task (${task.recurrence_rule}) from #${task.id}`);
}

// GET all tasks (with labels, subtasks)
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { is_archived, status_id, sprint_id, label_id, search, status_phase, do_date_from, do_date_to, has_do_date } = req.query;

  let where = ['1=1'];
  const params: any[] = [];

  if (is_archived !== undefined) {
    where.push('t.is_archived = ?');
    params.push(Number(is_archived));
  } else {
    where.push('t.is_archived = 0');
  }

  if (status_id) {
    where.push('t.status_id = ?');
    params.push(Number(status_id));
  }

  if (status_phase) {
    where.push('s.phase = ?');
    params.push(status_phase);
  }

  if (sprint_id) {
    where.push('t.sprint_id = ?');
    params.push(Number(sprint_id));
  }

  if (search) {
    where.push('(t.title LIKE ? OR t.details LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term);
  }

  if (do_date_from) {
    where.push('t.do_date >= ?');
    params.push(do_date_from);
  }
  if (do_date_to) {
    where.push('t.do_date <= ?');
    params.push(do_date_to);
  }
  if (has_do_date === 'true') {
    where.push('t.do_date IS NOT NULL');
  }

  const tasks = db.prepare(`
    SELECT t.*, s.name as status_name, s.phase as status_phase, s.color as status_color,
           sp.name as sprint_name,
           us.title as user_story_title
    FROM tasks t
    LEFT JOIN statuses s ON t.status_id = s.id
    LEFT JOIN sprints sp ON t.sprint_id = sp.id
    LEFT JOIN user_stories us ON t.user_story_id = us.id
    WHERE ${where.join(' AND ')}
    ORDER BY t.created_at DESC
  `).all(...params);

  // Attach labels and subtasks
  const taskIds = tasks.map((t: any) => t.id);
  if (taskIds.length > 0) {
    const placeholders = taskIds.map(() => '?').join(',');

    const labels = db.prepare(`
      SELECT tl.task_id, l.id, l.name, l.color
      FROM task_labels tl JOIN labels l ON tl.label_id = l.id
      WHERE tl.task_id IN (${placeholders})
    `).all(...taskIds);

    const subtasks = db.prepare(`
      SELECT * FROM subtasks WHERE task_id IN (${placeholders}) ORDER BY sort_order
    `).all(...taskIds);

    const labelMap: Record<number, any[]> = {};
    (labels as any[]).forEach(l => {
      if (!labelMap[l.task_id]) labelMap[l.task_id] = [];
      labelMap[l.task_id].push({ id: l.id, name: l.name, color: l.color });
    });

    const subtaskMap: Record<number, any[]> = {};
    (subtasks as any[]).forEach(s => {
      if (!subtaskMap[s.task_id]) subtaskMap[s.task_id] = [];
      subtaskMap[s.task_id].push(s);
    });

    (tasks as any[]).forEach(t => {
      t.labels = labelMap[t.id] || [];
      t.subtasks = subtaskMap[t.id] || [];
    });
  }

  if (label_id) {
    const lid = Number(label_id);
    res.json((tasks as any[]).filter(t => t.labels.some((l: any) => l.id === lid)));
    return;
  }

  res.json(tasks);
});

// ── Kanban reorder ── (must be before /:id to avoid route conflict)
router.put('/kanban/reorder', (req: Request, res: Response) => {
  const db = getDb();
  const { order } = req.body;
  if (!Array.isArray(order)) { res.status(400).json({ error: 'order must be an array of task IDs' }); return; }

  const update = db.prepare("UPDATE tasks SET kanban_order = ?, updated_at = datetime('now') WHERE id = ?");
  const reorder = db.transaction((ids: number[]) => {
    ids.forEach((id, i) => update.run(i, id));
  });
  reorder(order);

  res.json({ success: true });
});

// ── My Day ── (must be before /:id to avoid route conflict)

// Reorder my-day tasks for a specific date
router.put('/my-day/reorder', (req: Request, res: Response) => {
  const db = getDb();
  const { order } = req.body;
  if (!Array.isArray(order)) { res.status(400).json({ error: 'order must be an array of task IDs' }); return; }

  const update = db.prepare("UPDATE tasks SET my_day_order = ?, updated_at = datetime('now') WHERE id = ?");
  const reorder = db.transaction((ids: number[]) => {
    ids.forEach((id, i) => update.run(i, id));
  });
  reorder(order);

  res.json({ success: true });
});

// Add task to My Day
router.post('/my-day/:taskId', (req: Request, res: Response) => {
  const db = getDb();
  const taskId = Number(req.params.taskId);
  const today = new Date().toISOString().split('T')[0];

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  if (!task) { res.status(404).json({ error: 'Task not found' }); return; }

  const doDate = task.do_date || today;
  const maxOrder = db.prepare('SELECT MAX(my_day_order) as max_order FROM tasks WHERE do_date = ?').get(doDate) as any;
  const nextOrder = (maxOrder?.max_order ?? -1) + 1;

  db.prepare("UPDATE tasks SET do_date = ?, my_day_order = ?, updated_at = datetime('now') WHERE id = ?").run(doDate, nextOrder, taskId);
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId));
});

// Remove task from My Day
router.delete('/my-day/:taskId', (req: Request, res: Response) => {
  const db = getDb();
  const taskId = Number(req.params.taskId);
  db.prepare("UPDATE tasks SET my_day_order = NULL, updated_at = datetime('now') WHERE id = ?").run(taskId);
  res.json({ success: true });
});

// ── Work Summary ── (must be before /:id)
router.get('/work-summary', (req: Request, res: Response) => {
  const db = getDb();
  const { scope, sprint_id, date_from, date_to } = req.query;

  let where = 't.is_archived = 0';
  const params: any[] = [];

  // Filter by scope
  if (scope === 'sprint' && sprint_id) {
    where += ' AND t.sprint_id = ?';
    params.push(Number(sprint_id));
  }
  if (date_from) {
    where += ' AND t.updated_at >= ?';
    params.push(date_from);
  }
  if (date_to) {
    where += " AND t.updated_at <= ? || ' 23:59:59'";
    params.push(date_to);
  }

  // Get done status
  const doneStatus = db.prepare("SELECT id FROM statuses WHERE name = 'Done' LIMIT 1").get() as any;
  const doneId = doneStatus?.id;

  // Get all tasks in scope
  const tasks = db.prepare(`
    SELECT t.*, s.name as status_name, s.phase as status_phase,
           sp.name as sprint_name, us.title as user_story_title
    FROM tasks t
    LEFT JOIN statuses s ON t.status_id = s.id
    LEFT JOIN sprints sp ON t.sprint_id = sp.id
    LEFT JOIN user_stories us ON t.user_story_id = us.id
    WHERE ${where}
    ORDER BY t.updated_at DESC
  `).all(...params) as any[];

  // Enrich with labels
  tasks.forEach(t => {
    t.labels = db.prepare(
      'SELECT l.name FROM task_labels tl JOIN labels l ON tl.label_id = l.id WHERE tl.task_id = ?'
    ).all(t.id).map((r: any) => r.name);
  });

  const completed = tasks.filter(t => t.status_id === doneId);
  const inProgress = tasks.filter(t => t.status_phase === 'execution' && t.status_id !== doneId);
  const totalEffort = tasks.reduce((s: number, t: any) => s + (t.effort_estimate || 0), 0);
  const completedEffort = completed.reduce((s: number, t: any) => s + (t.effort_estimate || 0), 0);

  res.json({
    summary: {
      total: tasks.length,
      completed: completed.length,
      in_progress: inProgress.length,
      total_effort: totalEffort,
      completed_effort: completedEffort,
    },
    completed_tasks: completed.map(t => ({
      id: t.id, title: t.title, effort: t.effort_estimate,
      labels: t.labels, sprint: t.sprint_name, user_story: t.user_story_title,
      do_date: t.do_date, updated_at: t.updated_at,
    })),
    in_progress_tasks: inProgress.map(t => ({
      id: t.id, title: t.title, status: t.status_name, effort: t.effort_estimate,
      labels: t.labels, sprint: t.sprint_name, user_story: t.user_story_title,
    })),
    all_tasks: tasks.map(t => ({
      id: t.id, title: t.title, status: t.status_name, effort: t.effort_estimate,
      labels: t.labels, sprint: t.sprint_name, user_story: t.user_story_title,
      do_date: t.do_date,
    })),
  });
});

// GET single task
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const task = db.prepare(`
    SELECT t.*, s.name as status_name, s.phase as status_phase, s.color as status_color,
           sp.name as sprint_name,
           us.title as user_story_title
    FROM tasks t
    LEFT JOIN statuses s ON t.status_id = s.id
    LEFT JOIN sprints sp ON t.sprint_id = sp.id
    LEFT JOIN user_stories us ON t.user_story_id = us.id
    WHERE t.id = ?
  `).get(Number(req.params.id));

  if (!task) { res.status(404).json({ error: 'Task not found' }); return; }

  const t = task as any;
  t.labels = db.prepare(`
    SELECT l.id, l.name, l.color
    FROM task_labels tl JOIN labels l ON tl.label_id = l.id
    WHERE tl.task_id = ?
  `).all(t.id);

  t.subtasks = db.prepare(`
    SELECT * FROM subtasks WHERE task_id = ? ORDER BY sort_order
  `).all(t.id);

  res.json(t);
});

// CREATE task
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const {
    title, status_id, user_story_id, do_date, start_date, end_date,
    sprint_id, effort_estimate, details, requires_other, requires_other_note,
    color_override, template_origin_id, labels, subtasks, is_priority
  } = req.body;

  if (!title) { res.status(400).json({ error: 'Title is required' }); return; }

  // Use provided status_id, or look up the default from settings, or fall back to Backlog
  let statusId = status_id;
  if (!statusId) {
    const defaultStatusSetting = db.prepare("SELECT value FROM app_settings WHERE key = 'default_task_status'").get() as any;
    if (defaultStatusSetting) {
      const found = db.prepare('SELECT id FROM statuses WHERE name = ?').get(defaultStatusSetting.value) as any;
      if (found) statusId = found.id;
    }
    if (!statusId) {
      statusId = (db.prepare('SELECT id FROM statuses WHERE name = ?').get('Backlog') as any)?.id || 1;
    }
  }

  const result = db.prepare(`
    INSERT INTO tasks (title, status_id, user_story_id, do_date, start_date, end_date,
      sprint_id, effort_estimate, details, requires_other, requires_other_note,
      color_override, template_origin_id, is_priority)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title, statusId, user_story_id || null, do_date || null, start_date || null,
    end_date || null, sprint_id || null, effort_estimate || null,
    details || '', requires_other ? 1 : 0, requires_other_note || null,
    color_override || null, template_origin_id || null, is_priority ? 1 : 0
  );

  const taskId = result.lastInsertRowid;

  // Add labels
  if (labels && Array.isArray(labels)) {
    const insertLabel = db.prepare('INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?, ?)');
    labels.forEach((labelId: number) => insertLabel.run(taskId, labelId));
  }

  // Add subtasks
  if (subtasks && Array.isArray(subtasks)) {
    const insertSubtask = db.prepare('INSERT INTO subtasks (task_id, title, sort_order) VALUES (?, ?, ?)');
    subtasks.forEach((s: string, i: number) => insertSubtask.run(taskId, s, i));
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  logActivity('task', Number(taskId), 'created', `Created task "${title}"`);
  res.status(201).json(task);
});

// UPDATE task
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) { res.status(404).json({ error: 'Task not found' }); return; }

  const fields = [
    'title', 'status_id', 'user_story_id', 'do_date', 'start_date', 'end_date',
    'sprint_id', 'effort_estimate', 'details', 'requires_other', 'requires_other_note',
    'color_override', 'is_archived', 'is_quick', 'is_priority', 'my_day_order', 'kanban_order', 'template_origin_id',
    'recurrence_rule', 'recurrence_parent_id',
  ];

  const updates: string[] = [];
  const params: any[] = [];

  fields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      let val = req.body[field];
      if (field === 'requires_other') val = val ? 1 : 0;
      if (field === 'is_quick') val = val ? 1 : 0;
      if (field === 'is_priority') val = val ? 1 : 0;
      if (field === 'details') { val = val ?? ''; }
      else if (val === null || val === '') { val = null; }
      params.push(val);
    }
  });

  if (updates.length > 0) {
    const newStatus = req.body.status_id
      ? db.prepare('SELECT name FROM statuses WHERE id = ?').get(req.body.status_id) as any
      : null;
    const statusChanged = req.body.status_id && req.body.status_id !== (existing as any).status_id;
    if (statusChanged && newStatus?.name === 'Done') updates.push("completed_at = datetime('now')");
    if (statusChanged && newStatus?.name !== 'Done') updates.push('completed_at = NULL');
    updates.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  // Update labels if provided (accept both 'labels' and 'label_ids')
  const labelIds = req.body.label_ids ?? req.body.labels;
  if (labelIds !== undefined) {
    db.prepare('DELETE FROM task_labels WHERE task_id = ?').run(id);
    const insertLabel = db.prepare('INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?, ?)');
    (labelIds as number[]).forEach(labelId => insertLabel.run(id, labelId));
  }

  // Log status changes specifically
  if (req.body.status_id && req.body.status_id !== (existing as any).status_id) {
    const oldStatus = db.prepare('SELECT name FROM statuses WHERE id = ?').get((existing as any).status_id) as any;
    const newStatus = db.prepare('SELECT name FROM statuses WHERE id = ?').get(req.body.status_id) as any;
    logActivity('task', id, 'status_changed', `Status: ${oldStatus?.name || '?'} → ${newStatus?.name || '?'}`);

    // Auto-create next occurrence for recurring tasks completed to "Done"
    if (newStatus?.name === 'Done') {
      const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
      if (updatedTask?.recurrence_rule) {
        createNextRecurrence(db, updatedTask);
      }
    }
  } else if (updates.length > 0) {
    logActivity('task', id, 'updated', `Updated: ${updates.map(u => u.split(' =')[0]).join(', ')}`);
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json(task);
});

// DELETE task
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) { res.status(404).json({ error: 'Task not found' }); return; }

  logActivity('task', id, 'deleted', `Deleted task "${(existing as any).title}"`);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  res.json({ success: true });
});

// DUPLICATE task
router.post('/:id/duplicate', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  const src = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
  if (!src) { res.status(404).json({ error: 'Task not found' }); return; }

  const result = db.prepare(`
    INSERT INTO tasks (title, status_id, user_story_id, do_date, start_date, end_date,
      sprint_id, effort_estimate, details, requires_other, requires_other_note,
      color_override, is_quick, is_priority, template_origin_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `${src.title} (copy)`, src.status_id, src.user_story_id, src.do_date, src.start_date,
    src.end_date, src.sprint_id, src.effort_estimate, src.details,
    src.requires_other, src.requires_other_note, src.color_override, src.is_quick, src.is_priority, src.template_origin_id
  );

  const newId = result.lastInsertRowid;

  // Copy labels
  const labels = db.prepare('SELECT label_id FROM task_labels WHERE task_id = ?').all(id) as any[];
  const insLabel = db.prepare('INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?, ?)');
  labels.forEach(l => insLabel.run(newId, l.label_id));

  // Copy subtasks
  const subs = db.prepare('SELECT title, sort_order FROM subtasks WHERE task_id = ? ORDER BY sort_order').all(id) as any[];
  const insSub = db.prepare('INSERT INTO subtasks (task_id, title, sort_order) VALUES (?, ?, ?)');
  subs.forEach(s => insSub.run(newId, s.title, s.sort_order));

  logActivity('task', Number(newId), 'created', `Duplicated from task #${id} "${src.title}"`);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(newId);
  res.status(201).json(task);
});

// --- Subtask routes ---

// Update subtask
router.put('/:taskId/subtasks/:subtaskId', (req: Request, res: Response) => {
  const db = getDb();
  const { title, is_completed, sort_order } = req.body;
  const updates: string[] = [];
  const params: any[] = [];

  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (is_completed !== undefined) { updates.push('is_completed = ?'); params.push(is_completed ? 1 : 0); }
  if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }

  if (updates.length > 0) {
    params.push(Number(req.params.subtaskId));
    db.prepare(`UPDATE subtasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  // Update task updated_at
  db.prepare("UPDATE tasks SET updated_at = datetime('now') WHERE id = ?").run(Number(req.params.taskId));

  res.json(db.prepare('SELECT * FROM subtasks WHERE id = ?').get(Number(req.params.subtaskId)));
});

// Add subtask
router.post('/:taskId/subtasks', (req: Request, res: Response) => {
  const db = getDb();
  const taskId = Number(req.params.taskId);
  const { title } = req.body;
  if (!title) { res.status(400).json({ error: 'Title required' }); return; }

  const maxOrder = db.prepare('SELECT MAX(sort_order) as max_order FROM subtasks WHERE task_id = ?').get(taskId) as any;
  const sortOrder = (maxOrder?.max_order ?? -1) + 1;

  const result = db.prepare('INSERT INTO subtasks (task_id, title, sort_order) VALUES (?, ?, ?)').run(taskId, title, sortOrder);
  db.prepare("UPDATE tasks SET updated_at = datetime('now') WHERE id = ?").run(taskId);

  res.status(201).json(db.prepare('SELECT * FROM subtasks WHERE id = ?').get(result.lastInsertRowid));
});

// Delete subtask
router.delete('/:taskId/subtasks/:subtaskId', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM subtasks WHERE id = ?').run(Number(req.params.subtaskId));
  db.prepare("UPDATE tasks SET updated_at = datetime('now') WHERE id = ?").run(Number(req.params.taskId));
  res.json({ success: true });
});

// Reorder subtasks
router.put('/:taskId/subtasks-order', (req: Request, res: Response) => {
  const db = getDb();
  const { order } = req.body; // array of subtask IDs in new order
  if (!Array.isArray(order)) { res.status(400).json({ error: 'order must be an array' }); return; }

  const update = db.prepare('UPDATE subtasks SET sort_order = ? WHERE id = ?');
  const updateMany = db.transaction((ids: number[]) => {
    ids.forEach((id, i) => update.run(i, id));
  });
  updateMany(order);

  db.prepare("UPDATE tasks SET updated_at = datetime('now') WHERE id = ?").run(Number(req.params.taskId));
  res.json({ success: true });
});

export default router;
