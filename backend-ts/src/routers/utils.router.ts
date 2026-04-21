/**
 * Utils router — /, /health, /help, /health/model.
 * Mirrors backend/routers/utils_router.py.
 *
 * /health/model branches per provider with a minimal "ping" prompt.
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { Ollama } from 'ollama';
import { runtimeConfig } from '../config/runtime.js';
import { ErrorSchema } from '../schemas/common.schema.js';

export const utilsRouter = new OpenAPIHono();

// ─── GET / ───────────────────────────────────────────────
const RootSchema = z
  .object({
    message: z.string(),
    docs: z.string(),
    redoc: z.string(),
    help: z.string(),
    health: z.string(),
  })
  .openapi('Root');

utilsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Utilities'],
    responses: {
      200: { content: { 'application/json': { schema: RootSchema } }, description: 'Root info' },
    },
  }),
  (c) =>
    c.json({
      message: 'YUMMY Backend API - AI-powered SDLC Platform',
      docs: '/docs',
      redoc: '/redoc',
      help: '/help',
      health: '/health',
    }),
);

// ─── GET /health ─────────────────────────────────────────
const HealthSchema = z.object({ status: z.literal('ok') }).openapi('Health');

utilsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/health',
    tags: ['Utilities'],
    responses: {
      200: { content: { 'application/json': { schema: HealthSchema } }, description: 'OK' },
    },
  }),
  (c) => c.json({ status: 'ok' as const }),
);

// ─── GET /health/model ───────────────────────────────────
const HealthModelSchema = z
  .object({
    status: z.enum(['ok', 'error']),
    provider: z.string(),
    model: z.string(),
    latency_ms: z.number().optional(),
    error: z.string().optional(),
  })
  .openapi('HealthModel');

utilsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/health/model',
    tags: ['Utilities'],
    summary: 'Ping the configured AI provider with a minimal prompt.',
    responses: {
      200: { content: { 'application/json': { schema: HealthModelSchema } }, description: 'Result' },
    },
  }),
  async (c) => {
    const provider = runtimeConfig.provider;
    const start = Date.now();
    const elapsed = () => Math.round(Date.now() - start);

    if (provider === 'gemini') {
      const key = runtimeConfig.gemini_key;
      const model = runtimeConfig.gemini_model;
      if (!key) {
        return c.json({ status: 'error' as const, provider, model, error: 'GEMINI_API_KEY not configured.' });
      }
      try {
        const client = new GoogleGenAI({ apiKey: key });
        await client.models.generateContent({
          model,
          contents: 'ping',
          config: { systemInstruction: 'Reply with the single word: pong', maxOutputTokens: 5 },
        });
        return c.json({ status: 'ok' as const, provider, model, latency_ms: elapsed() });
      } catch (e) {
        return c.json({ status: 'error' as const, provider, model, latency_ms: elapsed(), error: (e as Error).message });
      }
    }

    if (provider === 'openai') {
      const key = runtimeConfig.openai_key;
      const model = runtimeConfig.openai_model;
      if (!key) {
        return c.json({ status: 'error' as const, provider, model, error: 'OPENAI_API_KEY not configured.' });
      }
      try {
        const client = new OpenAI({ apiKey: key });
        await client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
        });
        return c.json({ status: 'ok' as const, provider, model, latency_ms: elapsed() });
      } catch (e) {
        return c.json({ status: 'error' as const, provider, model, latency_ms: elapsed(), error: (e as Error).message });
      }
    }

    if (provider === 'copilot') {
      const token = runtimeConfig.copilot_token;
      const model = runtimeConfig.copilot_model;
      if (!token) {
        return c.json({ status: 'error' as const, provider, model, error: 'Copilot token not configured.' });
      }
      try {
        const client = new OpenAI({
          apiKey: token,
          baseURL: 'https://api.githubcopilot.com',
          defaultHeaders: { 'Editor-Version': 'vscode/1.0.0', 'Copilot-Integration-Id': 'vscode-chat' },
        });
        await client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
        });
        return c.json({ status: 'ok' as const, provider, model, latency_ms: elapsed() });
      } catch (e) {
        return c.json({ status: 'error' as const, provider, model, latency_ms: elapsed(), error: (e as Error).message });
      }
    }

    if (provider === 'bedrock') {
      const accessKey = runtimeConfig.bedrock_access_key;
      const secretKey = runtimeConfig.bedrock_secret_key;
      const region = runtimeConfig.bedrock_region;
      const model = runtimeConfig.bedrock_model;
      if (!accessKey || !secretKey) {
        return c.json({ status: 'error' as const, provider, model, error: 'AWS credentials not configured.' });
      }
      try {
        const client = new BedrockRuntimeClient({
          region,
          credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
        });
        await client.send(
          new ConverseCommand({
            modelId: model,
            messages: [{ role: 'user', content: [{ text: 'ping' }] }],
          }),
        );
        return c.json({ status: 'ok' as const, provider, model, latency_ms: elapsed() });
      } catch (e) {
        return c.json({ status: 'error' as const, provider, model, latency_ms: elapsed(), error: (e as Error).message });
      }
    }

    // Ollama
    const baseUrl = runtimeConfig.ollama_base_url;
    const model = runtimeConfig.ollama_model;
    try {
      const client = new Ollama({ host: baseUrl });
      await client.chat({ model, messages: [{ role: 'user', content: 'ping' }], stream: false });
      return c.json({ status: 'ok' as const, provider: 'ollama', model, latency_ms: elapsed() });
    } catch (e) {
      return c.json({ status: 'error' as const, provider: 'ollama', model, error: (e as Error).message });
    }
  },
);

// ─── GET /help ───────────────────────────────────────────
const HelpSchema = z
  .object({
    commands: z.record(z.string(), z.string()),
    agent_pipeline: z.array(z.string()),
    workflow: z.array(z.string()),
  })
  .openapi('Help');

utilsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/help',
    tags: ['Utilities'],
    responses: {
      200: { content: { 'application/json': { schema: HelpSchema } }, description: 'Help' },
    },
  }),
  (c) =>
    c.json({
      commands: {
        'POST /config/api-key': 'Set Gemini API key (from Google AI Studio)',
        'POST /config/ollama': 'Configure local Ollama server',
        'POST /config/provider': 'Switch provider: gemini | ollama',
        'POST /config/setup': 'Setup GitHub repo (github_url, token, max_scan_limit)',
        'GET  /config/status': 'View full system status',
        'POST /sessions': 'Create a new session/workspace',
        'GET  /sessions': 'List all sessions',
        'GET  /sessions/{id}': 'Get session details',
        'DELETE /sessions/{id}': 'Delete a session',
        'POST /sessions/{id}/reset': 'Reset workflow state to idle',
        'POST /kb/scan': 'Scan and index codebase from GitHub (background)',
        'GET  /kb/scan/status': 'Poll scan progress (0-100%)',
        'GET  /kb': 'View knowledge base (tree, insights, summary)',
        'GET  /kb/file?path=...': 'View file content (IDE Simulator)',
        'DELETE /kb': 'Clear knowledge base',
        'POST /ask': 'RAG Chat: ask questions about the codebase',
        'POST /sdlc/start': 'Start SDLC with a Change Request (BA writes BRD)',
        'POST /sdlc/approve-ba': 'Approve BA output -> run SA + JIRA',
        'POST /sdlc/approve-sa': 'Approve SA output -> Dev Lead review',
        'POST /sdlc/approve-dev-lead': 'Approve Dev Lead -> DEV + SECURITY + QA + SRE',
        'GET  /sdlc/{id}/state': 'View SDLC state and outputs',
        'GET  /sdlc/{id}/history': 'View chat history',
        'GET  /metrics': 'Request logs + AI costs',
        'DELETE /metrics': 'Clear metrics logs',
      },
      agent_pipeline: [
        'BA       -> Business Requirements Document (BRD)',
        'SA       -> System Architecture Document (SAD)',
        'PM       -> JIRA Backlog (JSON, runs in parallel with SA)',
        'DEV LEAD -> SA Review + Implementation Plan',
        'DEV      -> Pseudocode / Code Structure',
        'SECURITY -> OWASP + Threat Model + Security Action Items',
        'QA       -> Test Plan + Test Cases',
        'SRE      -> Deployment Plan + Rollback',
      ],
      workflow: [
        '1. POST /config/api-key      -> set Gemini key (or /config/ollama + /config/provider)',
        '2. POST /config/setup        -> set GitHub repo URL',
        '3. POST /kb/scan             -> scan codebase',
        '4. GET  /kb/scan/status      -> poll until progress=100',
        '5. POST /sessions            -> create workspace',
        '6. POST /sdlc/start          -> submit Change Request',
        '7. POST /sdlc/approve-ba     -> approve BRD',
        '8. POST /sdlc/approve-sa     -> approve Architecture',
        '9. POST /sdlc/approve-dev-lead -> approve Implementation Plan',
        '10. GET /sdlc/{id}/state     -> view all outputs',
      ],
    }),
);

// Suppress unused-import warning when ErrorSchema is needed by other routes later.
void ErrorSchema;
