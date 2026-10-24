import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

// GET all statuses
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const statuses = db.prepare('SELECT * FROM statuses ORDER BY sort_order').all();
  res.json(statuses);
});

// CREATE status
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { name, phase, color } = req.body;
  if (!name || !phase) { res.status(400).json({ error: 'name and phase required' }); return; }

  const maxOrder = db.prepare('SELECT MAX(sort_order) as max_order FROM statuses').get() as any;
  const sortOrder = (maxOrder?.max_order ?? -1) + 1;

  const result = db.prepare('INSERT INTO statuses (name, phase, color, sort_order) VALUES (?, ?, ?, ?)').run(
    name, phase, color || '#6b7280', sortOrder
  );
  res.status(201).json(db.prepare('SELECT * FROM statuses WHERE id = ?').get(result.lastInsertRowid));
});

// UPDATE status
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { name, phase, color, sort_order } = req.body;

  const updates: string[] = [];
  const params: any[] = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (phase !== undefined) { updates.push('phase = ?'); params.push(phase); }
  if (color !== undefined) { updates.push('color = ?'); params.push(color); }
  if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }

  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE statuses SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  res.json(db.prepare('SELECT * FROM statuses WHERE id = ?').get(id));
});

// Reorder statuses
router.put('/reorder', (req: Request, res: Response) => {
  const db = getDb();
  const { order } = req.body; // array of status IDs in new order
  if (!Array.isArray(order)) { res.status(400).json({ error: 'order must be an array' }); return; }

  const update = db.prepare('UPDATE statuses SET sort_order = ? WHERE id = ?');
  const updateMany = db.transaction((ids: number[]) => {
    ids.forEach((id, i) => update.run(i, id));
  });
  updateMany(order);

  res.json(db.prepare('SELECT * FROM statuses ORDER BY sort_order').all());
});

// DELETE status
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);

  // Check if any tasks use this status
  const count = db.prepare('SELECT COUNT(*) as cnt FROM tasks WHERE status_id = ?').get(id) as any;
  if (count.cnt > 0) {
    res.status(400).json({ error: `Cannot delete: ${count.cnt} tasks use this status` });
    return;
  }

  const usCount = db.prepare('SELECT COUNT(*) as cnt FROM user_stories WHERE status_id = ?').get(id) as any;
  if (usCount.cnt > 0) {
    res.status(400).json({ error: `Cannot delete: ${usCount.cnt} user stories use this status` });
    return;
  }

  db.prepare('DELETE FROM statuses WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
