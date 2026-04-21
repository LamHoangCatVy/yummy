/**
 * Knowledge Base router — /kb/*.
 * Mirrors backend/routers/kb_router.py.
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { kbRepo } from '../db/repositories/kb.repo.js';
import { scanStatusRepo } from '../db/repositories/scan-status.repo.js';
import { conflict, HttpError } from '../lib/errors.js';
import { requireRepo } from '../lib/guards.js';
import { runScan } from '../services/scan/scan.service.js';
import { getRepoInfo, githubRaw } from '../services/github/github.service.js';
import {
  FileContentSchema,
  FileQuerySchema,
  KnowledgeBaseSchema,
  ScanStatusResponseSchema,
} from '../schemas/kb.schema.js';
import { ErrorSchema } from '../schemas/common.schema.js';

export const kbRouter = new OpenAPIHono();

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  'application/json': { schema },
});

// ─── GET /kb ─────────────────────────────────────────────
kbRouter.openapi(
  createRoute({
    method: 'get',
    path: '/kb',
    tags: ['Knowledge Base'],
    responses: {
      200: { content: json(KnowledgeBaseSchema), description: 'KB snapshot' },
    },
  }),
  (c) => {
    const snap = kbRepo.snapshot();
    return c.json({
      file_count: snap.tree.length,
      insight_count: snap.insights.length,
      has_summary: !!snap.project_summary,
      tree: snap.tree,
      insights: snap.insights.map((i) => ({ id: i.id, files: i.files, summary: i.summary })),
      project_summary: snap.project_summary,
    });
  },
);

// ─── POST /kb/scan ───────────────────────────────────────
kbRouter.openapi(
  createRoute({
    method: 'post',
    path: '/kb/scan',
    tags: ['Knowledge Base'],
    responses: {
      200: {
        content: json(z.object({ status: z.string(), message: z.string() })),
        description: 'Started',
      },
      400: { content: json(ErrorSchema), description: 'Repo not configured' },
      409: { content: json(ErrorSchema), description: 'Already running' },
    },
  }),
  (c) => {
    requireRepo();
    const cur = scanStatusRepo.get();
    if (cur && cur.running) {
      throw conflict('Scan is already running. Poll GET /kb/scan/status to track progress.');
    }
    // Fire-and-forget background task; matches FastAPI BackgroundTasks behaviour.
    runScan().catch((e) => console.error('[scan]', e));
    return c.json({
      status: 'started',
      message: 'Scan started in background. Poll GET /kb/scan/status to track progress.',
    }, 200);
  },
);

// ─── GET /kb/scan/status ─────────────────────────────────
kbRouter.openapi(
  createRoute({
    method: 'get',
    path: '/kb/scan/status',
    tags: ['Knowledge Base'],
    responses: {
      200: { content: json(ScanStatusResponseSchema), description: 'Status' },
    },
  }),
  (c) => {
    const s = scanStatusRepo.get();
    if (!s) {
      return c.json({
        running: false,
        text: 'No scan has been started yet.',
        progress: 0,
        error: false,
      });
    }
    return c.json(s);
  },
);

// ─── GET /kb/file?path=... ───────────────────────────────
kbRouter.openapi(
  createRoute({
    method: 'get',
    path: '/kb/file',
    tags: ['Knowledge Base'],
    request: { query: FileQuerySchema },
    responses: {
      200: { content: json(FileContentSchema), description: 'File content' },
      400: { content: json(ErrorSchema), description: 'Repo not configured' },
      404: { content: json(ErrorSchema), description: 'File not found' },
      502: { content: json(ErrorSchema), description: 'GitHub error' },
    },
  }),
  async (c) => {
    const { path } = c.req.valid('query');
    const ri = requireRepo();

    let branch: string;
    try {
      const repoData = await getRepoInfo(ri.owner, ri.repo);
      branch = repoData.default_branch ?? 'main';
    } catch {
      throw new HttpError(502, 'Unable to connect to GitHub API.');
    }

    const content = await githubRaw(ri.owner, ri.repo, branch, path);
    return c.json({ path, content, branch, repo: `${ri.owner}/${ri.repo}` }, 200);
  },
);

// ─── DELETE /kb ──────────────────────────────────────────
kbRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/kb',
    tags: ['Knowledge Base'],
    responses: {
      200: {
        content: json(z.object({ status: z.string(), message: z.string() })),
        description: 'Cleared',
      },
    },
  }),
  (c) => {
    kbRepo.resetAll();
    scanStatusRepo.clear();
    return c.json({ status: 'ok', message: 'Knowledge base cleared.' });
  },
);
