import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { currentWorkspace, DEFAULT_WORKSPACE_ID } from '../db';

const router = Router();

// Each workspace keeps its own uploads folder next to its database
function uploadsDirFor(dir: string): string {
  return path.join(dir, 'uploads');
}

// POST /api/uploads - accepts base64 image data
router.post('/', (req: Request, res: Response) => {
  const ws = currentWorkspace();
  const uploadsDir = uploadsDirFor(ws.dir);
  const { data, filename } = req.body;
  if (!data) {
    res.status(400).json({ error: 'No image data provided' });
    return;
  }

  // data is expected as a base64 string (possibly with data URI prefix)
  let base64Data = data;
  let ext = 'png';

  const match = data.match(/^data:image\/([\w+]+);base64,(.+)$/);
  if (match) {
    ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    base64Data = match[2];
  }

  const id = crypto.randomBytes(8).toString('hex');
  const safeName = `${id}.${ext}`;
  const filePath = path.join(uploadsDir, safeName);

  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    // Images are loaded by the browser directly (no custom headers), so non-default workspaces carry
    // their id in the URL. The default workspace keeps the original, parameter-free URL.
    const suffix = ws.id === DEFAULT_WORKSPACE_ID ? '' : `?ws=${encodeURIComponent(ws.id)}`;
    res.json({ url: `/api/uploads/${safeName}${suffix}` });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to save image: ' + e.message });
  }
});

// GET /api/uploads/:filename - serve uploaded images
router.get('/:filename', (req: Request, res: Response) => {
  const uploadsDir = uploadsDirFor(currentWorkspace().dir);
  const rawFilename = req.params.filename;
  const filename = path.basename(Array.isArray(rawFilename) ? rawFilename[0] : rawFilename); // prevent path traversal
  const filePath = path.join(uploadsDir, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  const ext = path.extname(filename).slice(1).toLowerCase();
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  };

  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

export default router;
