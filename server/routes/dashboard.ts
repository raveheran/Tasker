import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

// GET dashboard stats
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const sprintFilter = req.query.sprint_id ? Number(req.query.sprint_id) : null;
  const sprintWhere = sprintFilter ? ' AND t.sprint_id = ?' : '';
  const sprintParams = sprintFilter ? [sprintFilter] : [];

  const dateFrom = req.query.date_from as string | undefined;
  const dateTo = req.query.date_to as string | undefined;
  const dateWhere = dateFrom && dateTo ? " AND DATE(t.created_at) >= ? AND DATE(t.created_at) <= ?" : '';
  const dateParams = dateFrom && dateTo ? [dateFrom, dateTo] : [];
  const extraWhere = sprintWhere + dateWhere;
  const extraParams = [...sprintParams, ...dateParams];

  // Task counts by status
  const tasksByStatus = db.prepare(`
    SELECT s.id, s.name, s.color, s.phase, s.sort_order, COUNT(t.id) as count
    FROM statuses s
    LEFT JOIN tasks t ON t.status_id = s.id AND t.is_archived = 0${extraWhere}
    GROUP BY s.id
    ORDER BY s.sort_order
  `).all(...extraParams);

  // Total active tasks
  const totalTasks = db.prepare(`SELECT COUNT(*) as count FROM tasks t WHERE t.is_archived = 0${extraWhere}`).get(...extraParams) as any;

  // Tasks due today
  const today = new Date().toISOString().split('T')[0];
  const dueToday = db.prepare(`SELECT COUNT(*) as count FROM tasks t WHERE t.do_date = ? AND t.is_archived = 0${extraWhere}`).get(today, ...extraParams) as any;

  // Overdue tasks
  const overdue = db.prepare(`SELECT COUNT(*) as count FROM tasks t WHERE t.do_date < ? AND t.is_archived = 0 AND t.do_date IS NOT NULL${extraWhere}`).get(today, ...extraParams) as any;

  // Done vs not done (for pie chart)
  const doneStatus = db.prepare("SELECT id FROM statuses WHERE name = 'Done' LIMIT 1").get() as any;
  const doneTasks = doneStatus
    ? (db.prepare(`SELECT COUNT(*) as count FROM tasks t WHERE t.status_id = ? AND t.is_archived = 0${extraWhere}`).get(doneStatus.id, ...extraParams) as any).count
    : 0;

  // Tasks by phase
  const tasksByPhase = db.prepare(`
    SELECT s.phase, COUNT(t.id) as count
    FROM tasks t
    JOIN statuses s ON t.status_id = s.id
    WHERE t.is_archived = 0${extraWhere}
    GROUP BY s.phase
  `).all(...extraParams);

  // Active sprint info
  const activeSprint = db.prepare('SELECT * FROM sprints WHERE is_active = 1 LIMIT 1').get() as any;
  let sprintStats = null;
  if (activeSprint) {
    const sprintTasks = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE sprint_id = ? AND is_archived = 0').get(activeSprint.id) as any;
    const sprintDone = doneStatus
      ? (db.prepare('SELECT COUNT(*) as count FROM tasks WHERE sprint_id = ? AND status_id = ? AND is_archived = 0').get(activeSprint.id, doneStatus.id) as any).count
      : 0;
    const sprintEffort = db.prepare('SELECT COALESCE(SUM(effort_estimate), 0) as total FROM tasks WHERE sprint_id = ? AND is_archived = 0').get(activeSprint.id) as any;
    const sprintDoneEffort = doneStatus
      ? (db.prepare('SELECT COALESCE(SUM(effort_estimate), 0) as total FROM tasks WHERE sprint_id = ? AND status_id = ? AND is_archived = 0').get(activeSprint.id, doneStatus.id) as any).total
      : 0;

    sprintStats = {
      ...activeSprint,
      total_tasks: sprintTasks.count,
      done_tasks: sprintDone,
      total_effort: sprintEffort.total,
      done_effort: sprintDoneEffort,
    };
  }

  // Recently updated tasks (last 5)
  const recentTasks = db.prepare(`
    SELECT t.id, t.title, t.updated_at, s.name as status_name, s.color as status_color
    FROM tasks t
    LEFT JOIN statuses s ON t.status_id = s.id
    WHERE t.is_archived = 0${extraWhere}
    ORDER BY t.updated_at DESC
    LIMIT 5
  `).all(...extraParams) as any[];

  // Attach labels to recent tasks
  if (recentTasks.length > 0) {
    const ids = recentTasks.map(t => t.id);
    const placeholders = ids.map(() => '?').join(',');
    const labelRows = db.prepare(`
      SELECT tl.task_id, l.name, l.color
      FROM task_labels tl
      JOIN labels l ON l.id = tl.label_id
      WHERE tl.task_id IN (${placeholders})
    `).all(...ids) as any[];
    const labelMap = new Map<number, { name: string; color: string }[]>();
    for (const row of labelRows) {
      if (!labelMap.has(row.task_id)) labelMap.set(row.task_id, []);
      labelMap.get(row.task_id)!.push({ name: row.name, color: row.color });
    }
    for (const task of recentTasks) {
      task.labels = labelMap.get(task.id) || [];
    }
  }

  // User story count
  const totalStories = db.prepare('SELECT COUNT(*) as count FROM user_stories WHERE is_archived = 0').get() as any;

  // Note count
  const totalNotes = db.prepare('SELECT COUNT(*) as count FROM notes').get() as any;

  // Tasks by label (for bar chart)
  const tasksByLabel = db.prepare(`
    SELECT l.name, l.color, COUNT(tl.task_id) as count
    FROM labels l
    LEFT JOIN task_labels tl ON tl.label_id = l.id
    LEFT JOIN tasks t ON t.id = tl.task_id AND t.is_archived = 0${extraWhere}
    GROUP BY l.id
    HAVING count > 0
    ORDER BY count DESC
    LIMIT 10
  `).all(...extraParams);

  res.json({
    tasksByStatus,
    tasksByPhase,
    tasksByLabel,
    totalTasks: totalTasks.count,
    dueToday: dueToday.count,
    overdue: overdue.count,
    doneTasks,
    activeSprint: sprintStats,
    recentTasks,
    totalStories: totalStories.count,
    totalNotes: totalNotes.count,
  });
});

export default router;
