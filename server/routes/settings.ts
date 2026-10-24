import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

// GET all settings
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM app_settings').all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  res.json(settings);
});

// PUT update a setting
router.put('/:key', (req: Request, res: Response) => {
  const db = getDb();
  const { key } = req.params;
  const { value } = req.body;
  db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(key, String(value));
  res.json({ key, value: String(value) });
});

export default router;
