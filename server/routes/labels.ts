import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

// GET all labels
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM labels ORDER BY name').all());
});

// CREATE label
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { name, color } = req.body;
  if (!name) { res.status(400).json({ error: 'Name required' }); return; }

  const result = db.prepare('INSERT INTO labels (name, color) VALUES (?, ?)').run(name, color || '#6b7280');
  res.status(201).json(db.prepare('SELECT * FROM labels WHERE id = ?').get(result.lastInsertRowid));
});

// UPDATE label
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { name, color, is_hidden } = req.body;

  const updates: string[] = [];
  const params: any[] = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (color !== undefined) { updates.push('color = ?'); params.push(color); }
  if (is_hidden !== undefined) { updates.push('is_hidden = ?'); params.push(is_hidden ? 1 : 0); }

  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE labels SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  res.json(db.prepare('SELECT * FROM labels WHERE id = ?').get(id));
});

// DELETE label
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  db.prepare('DELETE FROM task_labels WHERE label_id = ?').run(id);
  db.prepare('DELETE FROM user_story_labels WHERE label_id = ?').run(id);
  db.prepare('DELETE FROM note_labels WHERE label_id = ?').run(id);
  db.prepare('DELETE FROM labels WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
