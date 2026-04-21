/**
 * Sessions router — /sessions/*.
 * Mirrors backend/routers/sessions_router.py.
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { sessionsRepo } from '../db/repositories/sessions.repo.js';
import { newSessionId } from '../lib/id.js';
import { requireSession } from '../lib/guards.js';
import { toSessionDetail, toSessionSummary } from '../lib/serializers.js';
import {
  NewSessionRequestSchema,
  SessionDetailSchema,
  SessionSummarySchema,
} from '../schemas/sessions.schema.js';
import { ErrorSchema } from '../schemas/common.schema.js';

export const sessionsRouter = new OpenAPIHono();

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  'application/json': { schema },
});

// ─── POST /sessions ──────────────────────────────────────
sessionsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/sessions',
    tags: ['Sessions'],
    request: { body: { content: json(NewSessionRequestSchema) } },
    responses: {
      200: { content: json(SessionDetailSchema), description: 'Created' },
    },
  }),
  (c) => {
    const req = c.req.valid('json');
    const sid = newSessionId();
    const name = req.name ?? `Session ${sessionsRepo.list().length + 1}`;
    const session = sessionsRepo.create(sid, name);
    return c.json(toSessionDetail(session));
  },
);

// ─── GET /sessions ───────────────────────────────────────
sessionsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/sessions',
    tags: ['Sessions'],
    responses: {
      200: { content: json(z.array(SessionSummarySchema)), description: 'List' },
    },
  }),
  (c) => c.json(sessionsRepo.list().map(toSessionSummary)),
);

// ─── GET /sessions/{session_id} ──────────────────────────
sessionsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/sessions/{session_id}',
    tags: ['Sessions'],
    request: { params: z.object({ session_id: z.string() }) },
    responses: {
      200: { content: json(SessionDetailSchema), description: 'Detail' },
      404: { content: json(ErrorSchema), description: 'Not found' },
    },
  }),
  (c) => {
    const { session_id } = c.req.valid('param');
    return c.json(toSessionDetail(requireSession(session_id)), 200);
  },
);

// ─── DELETE /sessions/{session_id} ───────────────────────
sessionsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/sessions/{session_id}',
    tags: ['Sessions'],
    request: { params: z.object({ session_id: z.string() }) },
    responses: {
      200: {
        content: json(z.object({ status: z.string(), session_id: z.string() })),
        description: 'Deleted',
      },
      404: { content: json(ErrorSchema), description: 'Not found' },
    },
  }),
  (c) => {
    const { session_id } = c.req.valid('param');
    requireSession(session_id); // raises 404
    sessionsRepo.delete(session_id);
    return c.json({ status: 'deleted', session_id }, 200);
  },
);

// ─── POST /sessions/{session_id}/reset ───────────────────
sessionsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/sessions/{session_id}/reset',
    tags: ['Sessions'],
    request: { params: z.object({ session_id: z.string() }) },
    responses: {
      200: {
        content: json(z.object({ status: z.string(), workflow_state: z.string() })),
        description: 'Reset',
      },
      404: { content: json(ErrorSchema), description: 'Not found' },
    },
  }),
  (c) => {
    const { session_id } = c.req.valid('param');
    requireSession(session_id);
    // Python only sets workflow_state to 'idle'; doesn't clear agent_outputs.
    sessionsRepo.update(session_id, { workflowState: 'idle' });
    return c.json({ status: 'ok', workflow_state: 'idle' }, 200);
  },
);
