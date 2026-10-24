import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

// GET all templates
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM templates ORDER BY is_default DESC, name').all());
});

// GET single template
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(Number(req.params.id));
  if (!template) { res.status(404).json({ error: 'Template not found' }); return; }
  res.json(template);
});

// CREATE template
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { name, description, details_content, subtasks_json } = req.body;
  if (!name) { res.status(400).json({ error: 'Name is required' }); return; }

  const result = db.prepare(`
    INSERT INTO templates (name, description, details_content, subtasks_json, is_default)
    VALUES (?, ?, ?, ?, 0)
  `).run(
    name,
    description || '',
    details_content || '',
    subtasks_json || '[]'
  );

  res.status(201).json(db.prepare('SELECT * FROM templates WHERE id = ?').get(result.lastInsertRowid));
});

// UPDATE template
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
  if (!existing) { res.status(404).json({ error: 'Template not found' }); return; }

  const { name, description, details_content, subtasks_json } = req.body;
  const updates: string[] = [];
  const params: any[] = [];

  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (details_content !== undefined) { updates.push('details_content = ?'); params.push(details_content); }
  if (subtasks_json !== undefined) { updates.push('subtasks_json = ?'); params.push(subtasks_json); }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE templates SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  res.json(db.prepare('SELECT * FROM templates WHERE id = ?').get(id));
});

// DELETE template
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as any;
  if (!existing) { res.status(404).json({ error: 'Template not found' }); return; }
  if (existing.is_default) { res.status(400).json({ error: 'Cannot delete default templates' }); return; }

  db.prepare('DELETE FROM templates WHERE id = ?').run(id);
  res.json({ success: true });
});

// Apply template to existing task (append)
router.post('/:id/apply/:taskId', (req: Request, res: Response) => {
  const db = getDb();
  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(Number(req.params.id)) as any;
  if (!template) { res.status(404).json({ error: 'Template not found' }); return; }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(req.params.taskId)) as any;
  if (!task) { res.status(404).json({ error: 'Task not found' }); return; }

  // Append details
  const newDetails = task.details
    ? `${task.details}\n\n${template.details_content}`
    : template.details_content;

  db.prepare("UPDATE tasks SET details = ?, template_origin_id = ?, updated_at = datetime('now') WHERE id = ?").run(
    newDetails, template.id, task.id
  );

  // Append subtasks
  const templateSubtasks = JSON.parse(template.subtasks_json || '[]');
  if (templateSubtasks.length > 0) {
    const maxOrder = db.prepare('SELECT MAX(sort_order) as max_order FROM subtasks WHERE task_id = ?').get(task.id) as any;
    let sortOrder = (maxOrder?.max_order ?? -1) + 1;

    const insert = db.prepare('INSERT INTO subtasks (task_id, title, sort_order) VALUES (?, ?, ?)');
    templateSubtasks.forEach((s: string) => {
      insert.run(task.id, s, sortOrder++);
    });
  }

  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id));
});

// Create a new task from template
router.post('/:id/create-task', (req: Request, res: Response) => {
  const db = getDb();
  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(Number(req.params.id)) as any;
  if (!template) { res.status(404).json({ error: 'Template not found' }); return; }

  const { status_id, sprint_id } = req.body;
  const statusId = status_id || (db.prepare("SELECT id FROM statuses WHERE name = 'Backlog' LIMIT 1").get() as any)?.id || 1;

  const result = db.prepare(`
    INSERT INTO tasks (title, details, status_id, sprint_id, template_origin_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(template.name, template.details_content, statusId, sprint_id || null, template.id);

  const taskId = result.lastInsertRowid;

  const subtasks = JSON.parse(template.subtasks_json || '[]');
  if (subtasks.length > 0) {
    const insert = db.prepare('INSERT INTO subtasks (task_id, title, sort_order) VALUES (?, ?, ?)');
    subtasks.forEach((s: string, i: number) => {
      insert.run(taskId, s, i);
    });
  }

  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId));
});

// CREATE note from template
router.post('/:id/create-note', (req: Request, res: Response) => {
  const db = getDb();
  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(Number(req.params.id)) as any;
  if (!template) { res.status(404).json({ error: 'Template not found' }); return; }

  const { sprint_id, parent_id } = req.body;

  const result = db.prepare(`
    INSERT INTO notes (title, content, sprint_id, template_origin_id, parent_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(template.name, template.details_content || '', sprint_id || null, template.id, parent_id || null);

  const noteId = result.lastInsertRowid;
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
  res.json(note);
});

export default router;
