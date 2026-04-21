/**
 * Config router — /config/*.
 * Mirrors backend/routers/config_router.py.
 *
 * Mutates `runtimeConfig` (in-memory) and persists repo info / github token
 * to the SQLite singleton tables.
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { runtimeConfig, envDefaults, type Provider } from '../config/runtime.js';
import { env } from '../config/env.js';
import { repoRepo } from '../db/repositories/repo.repo.js';
import { kbRepo } from '../db/repositories/kb.repo.js';
import { sessionsRepo } from '../db/repositories/sessions.repo.js';
import { scanStatusRepo } from '../db/repositories/scan-status.repo.js';
import { logsRepo } from '../db/repositories/logs.repo.js';
import { badRequest } from '../lib/errors.js';
import {
  BedrockConfigSchema,
  ConfigStatusSchema,
  CopilotConfigSchema,
  GeminiConfigSchema,
  OllamaConfigSchema,
  OpenAIConfigSchema,
  ProviderSwitchSchema,
  SetupRequestSchema,
  SetupResponseSchema,
} from '../schemas/config.schema.js';
import { ErrorSchema } from '../schemas/common.schema.js';

export const configRouter = new OpenAPIHono();

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  'application/json': { schema },
});

// ─── POST /config/api-key (Gemini) ───────────────────────
configRouter.openapi(
  createRoute({
    method: 'post',
    path: '/config/api-key',
    tags: ['Config'],
    request: { body: { content: json(GeminiConfigSchema) } },
    responses: {
      200: { content: json(z.object({ status: z.string(), model: z.string() })), description: 'OK' },
    },
  }),
  (c) => {
    const cfg = c.req.valid('json');
    if (cfg.api_key) runtimeConfig.gemini_key = cfg.api_key;
    if (cfg.model) runtimeConfig.gemini_model = cfg.model;
    return c.json({ status: 'ok', model: runtimeConfig.gemini_model });
  },
);

// ─── POST /config/ollama ─────────────────────────────────
configRouter.openapi(
  createRoute({
    method: 'post',
    path: '/config/ollama',
    tags: ['Config'],
    request: { body: { content: json(OllamaConfigSchema) } },
    responses: {
      200: {
        content: json(z.object({ status: z.string(), message: z.string(), note: z.string() })),
        description: 'OK',
      },
    },
  }),
  (c) => {
    const cfg = c.req.valid('json');
    runtimeConfig.ollama_base_url = cfg.base_url;
    runtimeConfig.ollama_model = cfg.model;
    return c.json({
      status: 'ok',
      message: `Ollama config đã set: ${cfg.base_url} / model=${cfg.model}`,
      note: "Gọi POST /config/provider với {'provider': 'ollama'} để switch sang Ollama.",
    });
  },
);

// ─── POST /config/provider ───────────────────────────────
configRouter.openapi(
  createRoute({
    method: 'post',
    path: '/config/provider',
    tags: ['Config'],
    request: { body: { content: json(ProviderSwitchSchema) } },
    responses: {
      200: { content: json(z.object({ status: z.string(), provider: z.string() })), description: 'OK' },
      400: { content: json(ErrorSchema), description: 'Bad provider' },
    },
  }),
  (c) => {
    const { provider } = c.req.valid('json');
    if (!['gemini', 'ollama', 'copilot', 'openai', 'bedrock'].includes(provider)) {
      throw badRequest('Provider must be one of: gemini, ollama, copilot, openai, bedrock.');
    }
    runtimeConfig.provider = provider as Provider;
    return c.json({ status: 'ok', provider }, 200);
  },
);

// ─── POST /config/openai ─────────────────────────────────
configRouter.openapi(
  createRoute({
    method: 'post',
    path: '/config/openai',
    tags: ['Config'],
    request: { body: { content: json(OpenAIConfigSchema) } },
    responses: {
      200: { content: json(z.object({ status: z.string(), model: z.string() })), description: 'OK' },
    },
  }),
  (c) => {
    const cfg = c.req.valid('json');
    if (cfg.api_key) runtimeConfig.openai_key = cfg.api_key;
    if (cfg.model) runtimeConfig.openai_model = cfg.model;
    return c.json({ status: 'ok', model: runtimeConfig.openai_model });
  },
);

// ─── POST /config/bedrock ────────────────────────────────
configRouter.openapi(
  createRoute({
    method: 'post',
    path: '/config/bedrock',
    tags: ['Config'],
    request: { body: { content: json(BedrockConfigSchema) } },
    responses: {
      200: {
        content: json(z.object({ status: z.string(), region: z.string(), model: z.string() })),
        description: 'OK',
      },
    },
  }),
  (c) => {
    const cfg = c.req.valid('json');
    if (cfg.access_key) runtimeConfig.bedrock_access_key = cfg.access_key;
    if (cfg.secret_key) runtimeConfig.bedrock_secret_key = cfg.secret_key;
    if (cfg.region) runtimeConfig.bedrock_region = cfg.region;
    if (cfg.model) runtimeConfig.bedrock_model = cfg.model;
    return c.json({
      status: 'ok',
      region: runtimeConfig.bedrock_region,
      model: runtimeConfig.bedrock_model,
    });
  },
);

// ─── POST /config/copilot ────────────────────────────────
configRouter.openapi(
  createRoute({
    method: 'post',
    path: '/config/copilot',
    tags: ['Config'],
    request: { body: { content: json(CopilotConfigSchema) } },
    responses: {
      200: { content: json(z.object({ status: z.string(), model: z.string() })), description: 'OK' },
    },
  }),
  (c) => {
    const cfg = c.req.valid('json');
    if (cfg.token) runtimeConfig.copilot_token = cfg.token;
    if (cfg.model) runtimeConfig.copilot_model = cfg.model;
    return c.json({ status: 'ok', model: runtimeConfig.copilot_model });
  },
);

// ─── POST /config/setup ──────────────────────────────────
const GITHUB_URL_RE = /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/;

configRouter.openapi(
  createRoute({
    method: 'post',
    path: '/config/setup',
    tags: ['Config'],
    request: { body: { content: json(SetupRequestSchema) } },
    responses: {
      200: { content: json(SetupResponseSchema), description: 'OK' },
      400: { content: json(ErrorSchema), description: 'Invalid URL' },
    },
  }),
  (c) => {
    const req = c.req.valid('json');
    const m = GITHUB_URL_RE.exec(req.github_url);
    if (!m) {
      throw badRequest('URL GitHub không hợp lệ. Ví dụ: https://github.com/owner/repo');
    }
    const owner = m[1]!;
    const repo = m[2]!;

    repoRepo.set({
      owner,
      repo,
      branch: null,
      url: req.github_url,
      githubToken: req.token ?? '',
      maxScanLimit: req.max_scan_limit ?? 10000,
    });

    return c.json({
      status: 'ok',
      owner,
      repo,
      max_scan_limit: req.max_scan_limit ?? 10000,
      note: 'Tiếp theo: POST /kb/scan để index codebase.',
    }, 200);
  },
);

// ─── GET /config/status ──────────────────────────────────
function keySource(envVar: string, configKey: keyof typeof runtimeConfig): 'env' | 'ui' | 'none' {
  const value = runtimeConfig[configKey];
  if (!value) return 'none';
  const envVal = (process.env[envVar] ?? '').trim();
  if (envVal) return value === envVal ? 'env' : 'ui';
  // Compare against snapshot taken at boot — if unchanged, the value came from env
  // (or is a baked-in default with no env set). Python uses os.getenv() check;
  // we mirror that: when env is empty, source is 'ui' if non-empty.
  return 'ui';
}

configRouter.openapi(
  createRoute({
    method: 'get',
    path: '/config/status',
    tags: ['Config'],
    responses: {
      200: { content: json(ConfigStatusSchema), description: 'OK' },
    },
  }),
  (c) => {
    const repo = repoRepo.get();
    const insightsCount = kbRepo.listInsights().length;
    const treeCount = kbRepo.listTree().length;
    const hasSummary = !!kbRepo.getProjectSummary();
    const totalSessions = sessionsRepo.list().length;
    const totalRequests = logsRepo.count();
    const totalCost = Math.round(logsRepo.totalCost() * 100000) / 100000;
    const scan = scanStatusRepo.get();

    return c.json({
      repo: repo
        ? { owner: repo.owner, repo: repo.repo, branch: repo.branch ?? null }
        : null,
      ai_provider: runtimeConfig.provider,
      has_gemini_key: !!runtimeConfig.gemini_key,
      gemini_key_source: keySource('GEMINI_API_KEY', 'gemini_key'),
      gemini_model: runtimeConfig.gemini_model,
      has_github_token: !!repoRepo.getGithubToken(),
      ollama_url: runtimeConfig.ollama_base_url || null,
      ollama_model: runtimeConfig.ollama_model,
      has_copilot_token: !!runtimeConfig.copilot_token,
      copilot_key_source: keySource('COPILOT_GITHUB_TOKEN', 'copilot_token'),
      copilot_model: runtimeConfig.copilot_model,
      has_openai_key: !!runtimeConfig.openai_key,
      openai_key_source: keySource('OPENAI_API_KEY', 'openai_key'),
      openai_model: runtimeConfig.openai_model,
      has_bedrock_key: !!runtimeConfig.bedrock_access_key,
      bedrock_key_source: keySource('AWS_ACCESS_KEY_ID', 'bedrock_access_key'),
      bedrock_region: runtimeConfig.bedrock_region,
      bedrock_model: runtimeConfig.bedrock_model,
      kb_files: treeCount,
      kb_insights: insightsCount,
      kb_has_summary: hasSummary,
      total_sessions: totalSessions,
      scan_status: scan
        ? { running: scan.running, text: scan.text, progress: scan.progress, error: scan.error }
        : null,
      total_requests: totalRequests,
      total_cost_usd: totalCost,
    });
  },
);

// Silence unused exports
void envDefaults;
void env;
