import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

// Global search across tasks, user stories, and notes
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { q, labels } = req.query;

  // Parse label IDs
  const labelIds: number[] = [];
  if (labels && typeof labels === 'string') {
    labels.split(',').forEach(s => {
      const n = Number(s.trim());
      if (Number.isInteger(n) && n > 0) labelIds.push(n);
    });
  }

  const hasText = q && typeof q === 'string' && q.trim().length >= 2;
  const hasLabels = labelIds.length > 0;

  if (!hasText && !hasLabels) {
    res.json({ tasks: [], userStories: [], notes: [] });
    return;
  }

  const term = hasText ? `%${(q as string).trim()}%` : null;

  // Build task query
  let taskSql = `
    SELECT DISTINCT t.id, t.title, t.details, t.do_date, t.is_archived,
      s.name as status_name, s.color as status_color
    FROM tasks t
    LEFT JOIN statuses s ON t.status_id = s.id
  `;
  const taskParams: any[] = [];
  const taskConditions: string[] = [];

  if (hasLabels) {
    const placeholders = labelIds.map(() => '?').join(',');
    taskSql += ` INNER JOIN task_labels tl ON tl.task_id = t.id AND tl.label_id IN (${placeholders})`;
    taskParams.push(...labelIds);
  }
  if (term) {
    taskConditions.push('(t.title LIKE ? OR t.details LIKE ?)');
    taskParams.push(term, term);
  }
  if (taskConditions.length > 0) {
    taskSql += ` WHERE ${taskConditions.join(' AND ')}`;
  }
  taskSql += ` ORDER BY t.is_archived ASC, t.updated_at DESC LIMIT 20`;

  const tasks = db.prepare(taskSql).all(...taskParams);

  // Build user story query
  let storySql = `
    SELECT DISTINCT us.id, us.title, us.details, us.is_archived,
      s.name as status_name, s.color as status_color
    FROM user_stories us
    LEFT JOIN statuses s ON us.status_id = s.id
  `;
  const storyParams: any[] = [];
  const storyConditions: string[] = [];

  if (hasLabels) {
    const placeholders = labelIds.map(() => '?').join(',');
    storySql += ` INNER JOIN user_story_labels usl ON usl.user_story_id = us.id AND usl.label_id IN (${placeholders})`;
    storyParams.push(...labelIds);
  }
  if (term) {
    storyConditions.push('(us.title LIKE ? OR us.details LIKE ?)');
    storyParams.push(term, term);
  }
  if (storyConditions.length > 0) {
    storySql += ` WHERE ${storyConditions.join(' AND ')}`;
  }
  storySql += ` ORDER BY us.is_archived ASC, us.updated_at DESC LIMIT 10`;

  const userStories = db.prepare(storySql).all(...storyParams);

  // Build notes query
  let noteSql = `
    SELECT DISTINCT n.id, n.title, n.content, n.updated_at
    FROM notes n
  `;
  const noteParams: any[] = [];
  const noteConditions: string[] = [];

  if (hasLabels) {
    const placeholders = labelIds.map(() => '?').join(',');
    noteSql += ` INNER JOIN note_labels nl ON nl.note_id = n.id AND nl.label_id IN (${placeholders})`;
    noteParams.push(...labelIds);
  }
  if (term) {
    noteConditions.push('(n.title LIKE ? OR n.content LIKE ?)');
    noteParams.push(term, term);
  }
  if (noteConditions.length > 0) {
    noteSql += ` WHERE ${noteConditions.join(' AND ')}`;
  }
  noteSql += ` ORDER BY n.updated_at DESC LIMIT 10`;

  const notes = db.prepare(noteSql).all(...noteParams);

  res.json({ tasks, userStories, notes });
});

export default router;
