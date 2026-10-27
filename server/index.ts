import express from 'express';
import cors from 'cors';
import path from 'path';
import { getDb, closeDb, currentWorkspace, DATA_DIR } from './db';
import { initWorkspaces, workspaceContext, listWorkspaces } from './workspaces';
import workspaceRoutes from './routes/workspaces';
import taskRoutes from './routes/tasks';
import statusRoutes from './routes/statuses';
import sprintRoutes from './routes/sprints';
import labelRoutes from './routes/labels';
import templateRoutes from './routes/templates';
import userStoryRoutes from './routes/user-stories';
import noteRoutes from './routes/notes';
import dashboardRoutes from './routes/dashboard';
import searchRoutes from './routes/search';
import exportRoutes from './routes/export';
import dependencyRoutes from './routes/dependencies';
import activityRoutes from './routes/activity';
import settingsRoutes from './routes/settings';
import uploadRoutes from './routes/uploads';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Workspace management is workspace-independent, so it is mounted before the workspace selector
app.use('/api/workspaces', workspaceRoutes);

// Every other API route runs against the workspace chosen by the X-Workspace header (or ?ws=)
app.use('/api', workspaceContext);

// API routes
app.get('/api/health', (_req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT 1 as ok').get() as any;
    if (row?.ok === 1) {
      const ws = currentWorkspace();
      res.json({ status: 'ok', db: 'connected', workspace: { id: ws.id, name: ws.name } });
    } else {
      res.status(500).json({ status: 'error', db: 'query failed' });
    }
  } catch (e: any) {
    res.status(500).json({ status: 'error', db: e.message });
  }
});
app.use('/api/tasks', taskRoutes);
app.use('/api/statuses', statusRoutes);
app.use('/api/sprints', sprintRoutes);
app.use('/api/labels', labelRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/user-stories', userStoryRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/tasks', dependencyRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/uploads', uploadRoutes);

// Serve static frontend
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// SPA fallback
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Load the workspace registry and open the default workspace (the original database, in place)
initWorkspaces();
getDb();

const server = app.listen(PORT, async () => {
  console.log(`\n  🚀 Tasker running at http://localhost:${PORT}`);
  console.log(`  Data folder: ${DATA_DIR}`);
  console.log(`  Workspaces: ${listWorkspaces(false).map((w) => w.name).join(', ')}\n`);

  // Open browser (set TASKER_NO_OPEN=1 to skip)
  if (process.env.TASKER_NO_OPEN) return;
  try {
    const open = (await import('open')).default;
    open(`http://localhost:${PORT}`);
  } catch {
    // ignore if open fails
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  closeDb();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  server.close();
  process.exit(0);
});
