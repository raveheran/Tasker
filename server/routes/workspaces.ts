import { Router, Request, Response } from 'express';
import { DEFAULT_WORKSPACE_ID } from '../db';
import {
  HttpError, listWorkspaces, createWorkspace, renameWorkspace, deleteWorkspace,
} from '../workspaces';

const router = Router();

function handle(res: Response, fn: () => unknown, status = 200): void {
  try {
    res.status(status).json(fn());
  } catch (e: any) {
    if (e instanceof HttpError) {
      res.status(e.status).json({ error: e.message, code: e.code });
    } else {
      res.status(500).json({ error: e?.message || 'Unexpected error' });
    }
  }
}

function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0] : v;
}

// GET /api/workspaces - list all workspaces (?stats=1 also opens each one for task count / last modified)
router.get('/', (req: Request, res: Response) => {
  handle(res, () => listWorkspaces(req.query.stats === '1' || req.query.stats === 'true'));
});

// POST /api/workspaces - create a new workspace with its own database ({ name })
router.post('/', (req: Request, res: Response) => {
  handle(res, () => createWorkspace(req.body?.name), 201);
});

// PUT /api/workspaces/:id - rename ({ name }); the folder on disk is unaffected
router.put('/:id', (req: Request, res: Response) => {
  handle(res, () => renameWorkspace(param(req, 'id'), req.body?.name));
});

// DELETE /api/workspaces/:id - move to trash ({ confirm_name } must equal the workspace name)
router.delete('/:id', (req: Request, res: Response) => {
  const caller = (req.header('x-workspace') || DEFAULT_WORKSPACE_ID).trim();
  handle(res, () => ({ success: true, ...deleteWorkspace(param(req, 'id'), req.body?.confirm_name, caller) }));
});

export default router;
