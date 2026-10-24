import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

// GET all sprints
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const sprints = db.prepare('SELECT * FROM sprints ORDER BY start_date DESC').all();
  res.json(sprints);
});

// GET single sprint with stats
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const sprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(Number(req.params.id));
  if (!sprint) { res.status(404).json({ error: 'Sprint not found' }); return; }
  res.json(sprint);
});

// CREATE sprint
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { name, start_date, end_date } = req.body;
  if (!name) { res.status(400).json({ error: 'Name required' }); return; }

  const result = db.prepare('INSERT INTO sprints (name, start_date, end_date) VALUES (?, ?, ?)').run(
    name, start_date || null, end_date || null
  );
  res.status(201).json(db.prepare('SELECT * FROM sprints WHERE id = ?').get(result.lastInsertRowid));
});

// UPDATE sprint
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { name, start_date, end_date } = req.body;

  const updates: string[] = [];
  const params: any[] = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (start_date !== undefined) { updates.push('start_date = ?'); params.push(start_date); }
  if (end_date !== undefined) { updates.push('end_date = ?'); params.push(end_date); }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE sprints SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  res.json(db.prepare('SELECT * FROM sprints WHERE id = ?').get(id));
});

// Activate sprint
router.post('/:id/activate', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);

  db.transaction(() => {
    db.prepare('UPDATE sprints SET is_active = 0').run();
    db.prepare('UPDATE sprints SET is_active = 1 WHERE id = ?').run(id);
  })();

  res.json(db.prepare('SELECT * FROM sprints WHERE id = ?').get(id));
});

// DELETE sprint
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);

  // Unassign tasks from this sprint
  db.prepare('UPDATE tasks SET sprint_id = NULL WHERE sprint_id = ?').run(id);
  db.prepare('UPDATE user_stories SET sprint_id = NULL WHERE sprint_id = ?').run(id);
  db.prepare('DELETE FROM sprints WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
