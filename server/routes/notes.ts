import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

// GET all notes
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { sprint_id, label_id, search } = req.query;

  let sql = 'SELECT * FROM notes WHERE 1=1';
  const params: any[] = [];

  if (sprint_id) { sql += ' AND sprint_id = ?'; params.push(Number(sprint_id)); }
  if (search) { sql += ' AND (title LIKE ? OR content LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  sql += ' ORDER BY sort_order ASC, updated_at DESC';

  const notes = db.prepare(sql).all(...params) as any[];

  // Attach labels
  if (notes.length > 0) {
    const ids = notes.map(n => n.id);
    const placeholders = ids.map(() => '?').join(',');
    const labels = db.prepare(`
      SELECT nl.note_id, l.* FROM note_labels nl
      JOIN labels l ON nl.label_id = l.id
      WHERE nl.note_id IN (${placeholders})
    `).all(...ids) as any[];

    const labelMap: Record<number, any[]> = {};
    labels.forEach(l => {
      if (!labelMap[l.note_id]) labelMap[l.note_id] = [];
      labelMap[l.note_id].push({ id: l.id, name: l.name, color: l.color });
    });
    notes.forEach(n => { n.labels = labelMap[n.id] || []; });
  }

  if (label_id) {
    const lid = Number(label_id);
    const filtered = notes.filter((n: any) => n.labels.some((l: any) => l.id === lid));
    res.json(filtered);
    return;
  }

  res.json(notes);
});

// GET single note
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(Number(req.params.id)) as any;
  if (!note) { res.status(404).json({ error: 'Note not found' }); return; }

  note.labels = db.prepare(`
    SELECT l.* FROM note_labels nl
    JOIN labels l ON nl.label_id = l.id
    WHERE nl.note_id = ?
  `).all(note.id);

  note.links = db.prepare('SELECT * FROM note_links WHERE note_id = ?').all(note.id);

  res.json(note);
});

// CREATE note
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { title, content, sprint_id, label_ids, parent_id } = req.body;
  if (!title) { res.status(400).json({ error: 'Title required' }); return; }

  const result = db.prepare('INSERT INTO notes (title, content, sprint_id, parent_id) VALUES (?, ?, ?, ?)').run(
    title, content || '', sprint_id || null, parent_id || null
  );

  const id = result.lastInsertRowid as number;

  if (Array.isArray(label_ids)) {
    const insert = db.prepare('INSERT OR IGNORE INTO note_labels (note_id, label_id) VALUES (?, ?)');
    label_ids.forEach((lid: number) => insert.run(id, lid));
  }

  res.status(201).json(db.prepare('SELECT * FROM notes WHERE id = ?').get(id));
});

// BATCH reorder notes (set parent_id + sort_order for multiple notes)
// Must be before /:id to avoid matching "reorder" as id
router.put('/reorder/batch', (req: Request, res: Response) => {
  const db = getDb();
  const { items } = req.body; // [{ id, parent_id, sort_order }]
  if (!Array.isArray(items)) { res.status(400).json({ error: 'items array required' }); return; }

  const stmt = db.prepare('UPDATE notes SET parent_id = ?, sort_order = ? WHERE id = ?');
  const tx = db.transaction(() => {
    for (const item of items) {
      stmt.run(item.parent_id ?? null, item.sort_order ?? 0, item.id);
    }
  });
  tx();
  res.json({ success: true });
});

// UPDATE note
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { title, content, sprint_id, label_ids, parent_id, sort_order } = req.body;

  const updates: string[] = [];
  const params: any[] = [];

  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (content !== undefined) { updates.push('content = ?'); params.push(content); }
  if (sprint_id !== undefined) { updates.push('sprint_id = ?'); params.push(sprint_id); }
  if (parent_id !== undefined) { updates.push('parent_id = ?'); params.push(parent_id); }
  if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE notes SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  if (Array.isArray(label_ids)) {
    db.prepare('DELETE FROM note_labels WHERE note_id = ?').run(id);
    const insert = db.prepare('INSERT OR IGNORE INTO note_labels (note_id, label_id) VALUES (?, ?)');
    label_ids.forEach((lid: number) => insert.run(id, lid));
  }

  res.json(db.prepare('SELECT * FROM notes WHERE id = ?').get(id));
});

// DELETE note
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  db.prepare('DELETE FROM note_labels WHERE note_id = ?').run(id);
  db.prepare('DELETE FROM note_links WHERE note_id = ?').run(id);
  db.prepare('DELETE FROM task_note_links WHERE note_id = ?').run(id);
  db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  res.json({ success: true });
});

// ── Note ↔ Task Links (from note side) ──

// GET /api/notes/:id/linked-tasks
router.get('/:id/linked-tasks', (req: Request, res: Response) => {
  const db = getDb();
  const noteId = Number(req.params.id);
  const rows = db.prepare(`
    SELECT t.id, t.title, t.status_id, s.name as status_name, s.color as status_color, s.phase as status_phase
    FROM task_note_links tnl
    JOIN tasks t ON t.id = tnl.task_id
    JOIN statuses s ON s.id = t.status_id
    WHERE tnl.note_id = ?
    ORDER BY t.title
  `).all(noteId);
  res.json(rows);
});

// POST /api/notes/:id/linked-tasks
router.post('/:id/linked-tasks', (req: Request, res: Response) => {
  const db = getDb();
  const noteId = Number(req.params.id);
  const { task_id } = req.body;
  if (!task_id) {
    res.status(400).json({ error: 'task_id required' });
    return;
  }
  try {
    db.prepare('INSERT OR IGNORE INTO task_note_links (task_id, note_id) VALUES (?, ?)').run(task_id, noteId);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/notes/:id/linked-tasks/:taskId
router.delete('/:id/linked-tasks/:taskId', (req: Request, res: Response) => {
  const db = getDb();
  const noteId = Number(req.params.id);
  const taskId = Number(req.params.taskId);
  db.prepare('DELETE FROM task_note_links WHERE task_id = ? AND note_id = ?').run(taskId, noteId);
  res.json({ success: true });
});

export default router;
