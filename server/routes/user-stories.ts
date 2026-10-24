import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

// GET all user stories
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { is_archived, status_id, sprint_id, label_id, search, status_phase } = req.query;

  let sql = `
    SELECT us.*, s.name as status_name, s.phase as status_phase, s.color as status_color
    FROM user_stories us
    LEFT JOIN statuses s ON us.status_id = s.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (is_archived !== undefined) { sql += ' AND us.is_archived = ?'; params.push(Number(is_archived)); }
  else { sql += ' AND us.is_archived = 0'; }

  if (status_id) { sql += ' AND us.status_id = ?'; params.push(Number(status_id)); }
  if (sprint_id) { sql += ' AND us.sprint_id = ?'; params.push(Number(sprint_id)); }
  if (status_phase) { sql += ' AND s.phase = ?'; params.push(status_phase); }
  if (search) { sql += ' AND us.title LIKE ?'; params.push(`%${search}%`); }

  sql += ' ORDER BY us.created_at DESC';

  const stories = db.prepare(sql).all(...params) as any[];

  // Attach labels
  if (stories.length > 0) {
    const ids = stories.map(s => s.id);
    const placeholders = ids.map(() => '?').join(',');
    const labels = db.prepare(`
      SELECT usl.user_story_id, l.* FROM user_story_labels usl
      JOIN labels l ON usl.label_id = l.id
      WHERE usl.user_story_id IN (${placeholders})
    `).all(...ids) as any[];

    const labelMap: Record<number, any[]> = {};
    labels.forEach(l => {
      if (!labelMap[l.user_story_id]) labelMap[l.user_story_id] = [];
      labelMap[l.user_story_id].push({ id: l.id, name: l.name, color: l.color });
    });
    stories.forEach(s => { s.labels = labelMap[s.id] || []; });
  }

  // Attach task counts
  if (stories.length > 0) {
    const ids = stories.map(s => s.id);
    const placeholders = ids.map(() => '?').join(',');
    const counts = db.prepare(`
      SELECT user_story_id, COUNT(*) as total,
        SUM(CASE WHEN is_archived = 0 THEN 1 ELSE 0 END) as active
      FROM tasks
      WHERE user_story_id IN (${placeholders})
      GROUP BY user_story_id
    `).all(...ids) as any[];

    const countMap: Record<number, { total: number; active: number }> = {};
    counts.forEach(c => { countMap[c.user_story_id] = { total: c.total, active: c.active }; });
    stories.forEach(s => { s.task_count = countMap[s.id]?.total || 0; s.active_task_count = countMap[s.id]?.active || 0; });
  }

  if (label_id) {
    const lid = Number(label_id);
    const filtered = stories.filter((s: any) => s.labels.some((l: any) => l.id === lid));
    res.json(filtered);
    return;
  }

  res.json(stories);
});

// GET single user story with tasks
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const story = db.prepare(`
    SELECT us.*, s.name as status_name, s.phase as status_phase, s.color as status_color
    FROM user_stories us
    LEFT JOIN statuses s ON us.status_id = s.id
    WHERE us.id = ?
  `).get(Number(req.params.id)) as any;
  if (!story) { res.status(404).json({ error: 'User story not found' }); return; }

  // Labels
  story.labels = db.prepare(`
    SELECT l.* FROM user_story_labels usl
    JOIN labels l ON usl.label_id = l.id
    WHERE usl.user_story_id = ?
  `).all(story.id);

  // Tasks belonging to this story
  story.tasks = db.prepare(`
    SELECT t.*, s.name as status_name, s.color as status_color
    FROM tasks t LEFT JOIN statuses s ON t.status_id = s.id
    WHERE t.user_story_id = ?
    ORDER BY t.created_at DESC
  `).all(story.id);

  res.json(story);
});

// CREATE user story
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { title, status_id, sprint_id, details, color_override, label_ids } = req.body;
  if (!title) { res.status(400).json({ error: 'Title required' }); return; }

  const defaultStatus = db.prepare("SELECT id FROM statuses WHERE name = 'Backlog' LIMIT 1").get() as any;
  const sid = status_id || defaultStatus?.id || 1;

  const result = db.prepare(`
    INSERT INTO user_stories (title, status_id, sprint_id, details, color_override)
    VALUES (?, ?, ?, ?, ?)
  `).run(title, sid, sprint_id || null, details || '', color_override || null);

  const id = result.lastInsertRowid as number;

  if (Array.isArray(label_ids)) {
    const insert = db.prepare('INSERT OR IGNORE INTO user_story_labels (user_story_id, label_id) VALUES (?, ?)');
    label_ids.forEach((lid: number) => insert.run(id, lid));
  }

  const story = db.prepare('SELECT * FROM user_stories WHERE id = ?').get(id);
  res.status(201).json(story);
});

// UPDATE user story
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { title, status_id, sprint_id, details, color_override, is_archived, label_ids, labels } = req.body;

  const updates: string[] = [];
  const params: any[] = [];

  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (status_id !== undefined) { updates.push('status_id = ?'); params.push(status_id); }
  if (sprint_id !== undefined) { updates.push('sprint_id = ?'); params.push(sprint_id); }
  if (details !== undefined) { updates.push('details = ?'); params.push(details); }
  if (color_override !== undefined) { updates.push('color_override = ?'); params.push(color_override); }
  if (is_archived !== undefined) { updates.push('is_archived = ?'); params.push(is_archived); }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE user_stories SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  // Handle labels
  const labelArr = label_ids ?? labels;
  if (Array.isArray(labelArr)) {
    db.prepare('DELETE FROM user_story_labels WHERE user_story_id = ?').run(id);
    const insert = db.prepare('INSERT OR IGNORE INTO user_story_labels (user_story_id, label_id) VALUES (?, ?)');
    labelArr.forEach((lid: number) => insert.run(id, lid));
  }

  res.json(db.prepare('SELECT * FROM user_stories WHERE id = ?').get(id));
});

// DELETE user story
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);

  // Unlink tasks from this story
  db.prepare('UPDATE tasks SET user_story_id = NULL WHERE user_story_id = ?').run(id);
  db.prepare('DELETE FROM user_story_labels WHERE user_story_id = ?').run(id);
  db.prepare('DELETE FROM user_stories WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
