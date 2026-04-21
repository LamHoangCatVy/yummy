/**
 * RAG Ask router — /ask, /ask/free (SSE) and /ask/sync (JSON).
 * Mirrors backend/routers/ask_router.py.
 *
 * SSE protocol (matches Python verbatim):
 *   data: <chunk>\n\n         — token chunks (newlines escaped as \n)
 *   data: [ERROR] <msg>\n\n   — on stream failure
 *   data: [DONE]\n\n          — completion
 *   data: [TRACE] {...}\n\n   — RAG trace metadata (only on /ask)
 *
 * NOTE: SSE endpoints use plain `app.post()` because @hono/zod-openapi's
 * `createRoute` doesn't model streaming responses well. /ask/sync uses
 * OpenAPI typing.
 *
 * track() must be called explicitly here after the stream drains —
 * streamAI() does NOT track (Python parity).
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { stream } from 'hono/streaming';
import { sessionsRepo } from '../db/repositories/sessions.repo.js';
import { repoRepo } from '../db/repositories/repo.repo.js';
import { requireKnowledgeBase, requireSession } from '../lib/guards.js';
import { callAI, streamAI } from '../services/ai/dispatcher.js';
import { track } from '../services/ai/track.js';
import {
  AskRequestSchema,
  AskSyncResponseSchema,
  type AskRequest,
} from '../schemas/ask.schema.js';
import { ErrorSchema } from '../schemas/common.schema.js';

type KbSnapshot = ReturnType<typeof requireKnowledgeBase>;

export const askRouter = new OpenAPIHono();

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  'application/json': { schema },
});

// ─── _build_rag_prompt ───────────────────────────────────
interface TraceInfo {
  intent: string;
  retrieval_method: string;
  source_chunks: Array<{ files: string[]; summary_preview: string }>;
}

interface SessionLike {
  chatHistory: Array<{ role: string; text: string; trace?: unknown }>;
}

function buildRagPrompt(
  session: SessionLike,
  kb: KbSnapshot,
  req: AskRequest,
): { prompt: string; instruction: string; trace: TraceInfo } {
  const retrieved = kb.insights.slice(0, 2);
  const trace: TraceInfo = {
    intent: 'Code Structure Query',
    retrieval_method: 'top-k (k=2)',
    source_chunks: retrieved.map((c) => ({
      files: c.files,
      summary_preview: c.summary.slice(0, 200) + '...',
    })),
  };

  const kbContext =
    kb.project_summary +
    '\n\n=== TOP INSIGHTS ===\n' +
    retrieved.map((c) => c.summary).join('\n');

  let fileCtx = '';
  if (req.ide_file && req.ide_content) {
    fileCtx =
      `\n\n=== FILE OPEN IN IDE: ${req.ide_file} ===\n` +
      `${req.ide_content.slice(0, 4000)}\n`;
  }

  const recent = session.chatHistory.slice(-8);
  const history = recent
    .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
    .join('\n');

  const prompt =
    `=== REPO KNOWLEDGE (RAG Context) ===\n${kbContext}` +
    `${fileCtx}` +
    `\n\n=== CHAT HISTORY ===\n${history}` +
    `\n\n=== QUESTION ===\n${req.question}`;

  const repoName = repoRepo.get()?.repo ?? 'project';
  const instruction =
    `You are a technical expert on the '${repoName}' project. ` +
    'Answer the question based on the provided context. ' +
    'If information is insufficient, say so clearly. ' +
    'Reply in natural Markdown, concise and precise.';

  return { prompt, instruction, trace };
}

// ─── SSE response builder shared by /ask and /ask/free ───
function sseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
    Connection: 'keep-alive',
  };
}

function sseLine(data: string): string {
  return `data: ${data}\n\n`;
}

// ─── POST /ask  (SSE) ────────────────────────────────────
askRouter.post('/ask', async (c) => {
  const body = (await c.req.json()) as Partial<AskRequest>;
  const req = AskRequestSchema.parse(body);

  const session = requireSession(req.session_id);
  const kb = requireKnowledgeBase();
  const { prompt, instruction, trace } = buildRagPrompt(session, kb, req);

  // Persist user message immediately (matches Python).
  const newHistory = [
    ...session.chatHistory,
    { role: 'user', text: req.question },
  ];
  sessionsRepo.update(req.session_id, { chatHistory: newHistory });

  // Set SSE headers
  for (const [k, v] of Object.entries(sseHeaders())) c.header(k, v);

  return stream(c, async (s) => {
    const start = Date.now();
    const chunks: string[] = [];
    try {
      for await (const chunk of streamAI(prompt, instruction)) {
        chunks.push(chunk);
        const safe = chunk.replace(/\n/g, '\\n');
        await s.write(sseLine(safe));
      }
    } catch (e) {
      await s.write(sseLine(`[ERROR] ${(e as Error).message}`));
      return;
    }

    const answer = chunks.join('');

    // Persist assistant message + trace (re-fetch to avoid losing concurrent writes).
    const fresh = sessionsRepo.get(req.session_id);
    if (fresh) {
      sessionsRepo.update(req.session_id, {
        chatHistory: [
          ...fresh.chatHistory,
          { role: 'assistant', text: answer, trace },
        ],
      });
    }

    // Record metrics (streamAI does NOT track — Python parity).
    track({
      agentRole: 'EXPERT',
      prompt,
      instruction,
      resultText: answer,
      latencySeconds: (Date.now() - start) / 1000,
    });

    await s.write(sseLine('[DONE]'));
    await s.write(sseLine(`[TRACE] ${JSON.stringify(trace)}`));
  });
});

// ─── POST /ask/free  (SSE, no KB) ────────────────────────
askRouter.post('/ask/free', async (c) => {
  const body = (await c.req.json()) as Partial<AskRequest>;
  const req = AskRequestSchema.parse(body);

  const session = requireSession(req.session_id);

  const recent = session.chatHistory.slice(-8);
  const history = recent
    .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
    .join('\n');

  let fileCtx = '';
  if (req.ide_file && req.ide_content) {
    fileCtx =
      `\n\n=== FILE OPEN IN IDE: ${req.ide_file} ===\n` +
      `${req.ide_content.slice(0, 4000)}\n`;
  }

  const prompt =
    `${fileCtx}` +
    `\n\n=== CHAT HISTORY ===\n${history}` +
    `\n\n=== QUESTION ===\n${req.question}`;

  const instruction =
    'You are YUMMY, a helpful AI assistant for software development. ' +
    'Answer clearly and concisely in Markdown. ' +
    'You can discuss any topic — code, architecture, concepts, or general questions.';

  // Persist user message immediately.
  sessionsRepo.update(req.session_id, {
    chatHistory: [...session.chatHistory, { role: 'user', text: req.question }],
  });

  for (const [k, v] of Object.entries(sseHeaders())) c.header(k, v);

  return stream(c, async (s) => {
    const start = Date.now();
    const chunks: string[] = [];
    try {
      for await (const chunk of streamAI(prompt, instruction)) {
        chunks.push(chunk);
        const safe = chunk.replace(/\n/g, '\\n');
        await s.write(sseLine(safe));
      }
    } catch (e) {
      await s.write(sseLine(`[ERROR] ${(e as Error).message}`));
      return;
    }

    const answer = chunks.join('');

    const fresh = sessionsRepo.get(req.session_id);
    if (fresh) {
      sessionsRepo.update(req.session_id, {
        chatHistory: [
          ...fresh.chatHistory,
          { role: 'assistant', text: answer },
        ],
      });
    }

    track({
      agentRole: 'EXPERT',
      prompt,
      instruction,
      resultText: answer,
      latencySeconds: (Date.now() - start) / 1000,
    });

    await s.write(sseLine('[DONE]'));
  });
});

// ─── POST /ask/sync  (non-streaming JSON) ────────────────
askRouter.openapi(
  createRoute({
    method: 'post',
    path: '/ask/sync',
    tags: ['RAG Chat'],
    request: { body: { content: json(AskRequestSchema) } },
    responses: {
      200: { content: json(AskSyncResponseSchema), description: 'Answer' },
      400: { content: json(ErrorSchema), description: 'KB empty' },
      404: { content: json(ErrorSchema), description: 'Session not found' },
    },
  }),
  async (c) => {
    const req = c.req.valid('json');
    const session = requireSession(req.session_id);
    const kb = requireKnowledgeBase();
    const { prompt, instruction, trace } = buildRagPrompt(session, kb, req);

    const answer = await callAI('EXPERT', prompt, instruction);

    sessionsRepo.update(req.session_id, {
      chatHistory: [
        ...session.chatHistory,
        { role: 'user', text: req.question },
        { role: 'assistant', text: answer, trace },
      ],
    });

    return c.json(
      {
        question: req.question,
        answer,
        trace,
        session_id: req.session_id,
      },
      200,
    );
  },
);
