import { Router } from 'express';
import { getDb } from '../db';

const router = Router();

// ── Task Dependencies (task is blocked by depends_on_task) ──

// GET /api/tasks/:id/dependencies — tasks this task depends on (is blocked by)
router.get('/:id/dependencies', (req, res) => {
  const db = getDb();
  const taskId = Number(req.params.id);
  const rows = db.prepare(`
    SELECT t.id, t.title, t.status_id, s.name as status_name, s.color as status_color, s.phase as status_phase
    FROM task_dependencies d
    JOIN tasks t ON t.id = d.depends_on_task_id
    JOIN statuses s ON s.id = t.status_id
    WHERE d.task_id = ?
  `).all(taskId);
  res.json(rows);
});

// GET /api/tasks/:id/dependents — tasks that depend on this task (this task blocks)
router.get('/:id/dependents', (req, res) => {
  const db = getDb();
  const taskId = Number(req.params.id);
  const rows = db.prepare(`
    SELECT t.id, t.title, t.status_id, s.name as status_name, s.color as status_color, s.phase as status_phase
    FROM task_dependencies d
    JOIN tasks t ON t.id = d.task_id
    JOIN statuses s ON s.id = t.status_id
    WHERE d.depends_on_task_id = ?
  `).all(taskId);
  res.json(rows);
});

// POST /api/tasks/:id/dependencies — add dependency
router.post('/:id/dependencies', (req, res) => {
  const db = getDb();
  const taskId = Number(req.params.id);
  const { depends_on_task_id } = req.body;
  if (!depends_on_task_id || depends_on_task_id === taskId) {
    res.status(400).json({ error: 'Invalid dependency' });
    return;
  }
  // Check for circular dependency (A depends on B, B already depends on A)
  const circular = db.prepare(`
    SELECT 1 FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?
  `).get(depends_on_task_id, taskId);
  if (circular) {
    res.status(400).json({ error: 'Circular dependency detected' });
    return;
  }
  try {
    db.prepare('INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)').run(taskId, depends_on_task_id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/tasks/:id/dependencies/:depId — remove dependency
router.delete('/:id/dependencies/:depId', (req, res) => {
  const db = getDb();
  const taskId = Number(req.params.id);
  const depId = Number(req.params.depId);
  db.prepare('DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?').run(taskId, depId);
  res.json({ success: true });
});

// ── Task Relations (bidirectional links) ──

// GET /api/tasks/:id/relations
router.get('/:id/relations', (req, res) => {
  const db = getDb();
  const taskId = Number(req.params.id);
  const rows = db.prepare(`
    SELECT t.id, t.title, t.status_id, s.name as status_name, s.color as status_color, s.phase as status_phase
    FROM task_relations r
    JOIN tasks t ON t.id = CASE WHEN r.task_id = ? THEN r.related_task_id ELSE r.task_id END
    JOIN statuses s ON s.id = t.status_id
    WHERE r.task_id = ? OR r.related_task_id = ?
  `).all(taskId, taskId, taskId);
  res.json(rows);
});

// POST /api/tasks/:id/relations
router.post('/:id/relations', (req, res) => {
  const db = getDb();
  const taskId = Number(req.params.id);
  const { related_task_id } = req.body;
  if (!related_task_id || related_task_id === taskId) {
    res.status(400).json({ error: 'Invalid relation' });
    return;
  }
  // Always store the smaller id first for consistency
  const [a, b] = taskId < related_task_id ? [taskId, related_task_id] : [related_task_id, taskId];
  try {
    db.prepare('INSERT OR IGNORE INTO task_relations (task_id, related_task_id) VALUES (?, ?)').run(a, b);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/tasks/:id/relations/:relId
router.delete('/:id/relations/:relId', (req, res) => {
  const db = getDb();
  const taskId = Number(req.params.id);
  const relId = Number(req.params.relId);
  // Delete both directions
  db.prepare('DELETE FROM task_relations WHERE (task_id = ? AND related_task_id = ?) OR (task_id = ? AND related_task_id = ?)').run(taskId, relId, relId, taskId);
  res.json({ success: true });
});

// ── Task-Note Links ──

// GET /api/tasks/:id/linked-notes — notes linked to this task
router.get('/:id/linked-notes', (req, res) => {
  const db = getDb();
  const taskId = Number(req.params.id);
  const rows = db.prepare(`
    SELECT n.id, n.title, n.updated_at
    FROM task_note_links tnl
    JOIN notes n ON n.id = tnl.note_id
    WHERE tnl.task_id = ?
    ORDER BY n.title
  `).all(taskId);
  res.json(rows);
});

// POST /api/tasks/:id/linked-notes — link a note to this task
router.post('/:id/linked-notes', (req, res) => {
  const db = getDb();
  const taskId = Number(req.params.id);
  const { note_id } = req.body;
  if (!note_id) {
    res.status(400).json({ error: 'note_id required' });
    return;
  }
  try {
    db.prepare('INSERT OR IGNORE INTO task_note_links (task_id, note_id) VALUES (?, ?)').run(taskId, note_id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/tasks/:id/linked-notes/:noteId — unlink a note
router.delete('/:id/linked-notes/:noteId', (req, res) => {
  const db = getDb();
  const taskId = Number(req.params.id);
  const noteId = Number(req.params.noteId);
  db.prepare('DELETE FROM task_note_links WHERE task_id = ? AND note_id = ?').run(taskId, noteId);
  res.json({ success: true });
});

export default router;
