import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

// GET recent activity (with optional entity filter)
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { entity_type, entity_id, limit } = req.query;
  const maxRows = Math.min(Number(limit) || 50, 200);

  let where = '1=1';
  const params: any[] = [];

  if (entity_type) {
    where += ' AND entity_type = ?';
    params.push(entity_type);
  }
  if (entity_id) {
    where += ' AND entity_id = ?';
    params.push(Number(entity_id));
  }

  params.push(maxRows);

  const rows = db.prepare(`
    SELECT * FROM activity_log
    WHERE ${where}
    ORDER BY created_at DESC
    LIMIT ?
  `).all(...params);

  res.json(rows);
});

// DELETE all activity history
router.delete('/', (_req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM activity_log').run();
  res.json({ success: true });
});

export default router;

// ── Helper to log activity from other routes ──
export function logActivity(entityType: string, entityId: number, action: string, details?: string) {
  try {
    const db = getDb();
    db.prepare('INSERT INTO activity_log (entity_type, entity_id, action, details) VALUES (?, ?, ?, ?)').run(
      entityType, entityId, action, details || null
    );
  } catch {
    // Don't fail the main operation if logging fails
  }
}
