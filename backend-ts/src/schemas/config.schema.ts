/**
 * Config schemas — mirrors backend/models.py ConfigRequest classes
 * and inline payloads from config_router.py.
 */
import { z } from '@hono/zod-openapi';

const ProviderEnum = z
  .enum(['gemini', 'openai', 'ollama', 'copilot', 'bedrock'])
  .openapi({ example: 'gemini' });

// ─── Requests ────────────────────────────────────────────

export const SetupRequestSchema = z
  .object({
    github_url: z
      .string()
      .min(1)
      .openapi({ example: 'https://github.com/owner/repo' }),
    token: z.string().optional().default('').openapi({
      description: 'GitHub Personal Access Token (optional, for private repos)',
    }),
    max_scan_limit: z.number().int().positive().optional().default(10000).openapi({
      description: 'Maximum number of files to scan',
    }),
  })
  .openapi('SetupRequest');

export const GeminiConfigSchema = z
  .object({
    api_key: z.string().optional().default('').openapi({
      description: 'Gemini API Key from Google AI Studio',
    }),
    model: z.string().optional().openapi({
      description: 'Gemini model ID (optional, keeps current if not provided)',
    }),
  })
  .openapi('GeminiConfig');

export const OllamaConfigSchema = z
  .object({
    base_url: z.string().default('http://localhost:11434').openapi({
      description: 'Ollama local server URL',
    }),
    model: z.string().default('llama3').openapi({
      description: 'Ollama model name (llama3, codellama, mistral, ...)',
    }),
  })
  .openapi('OllamaConfig');

export const CopilotConfigSchema = z
  .object({
    token: z.string().min(1).openapi({
      description: 'GitHub token with Copilot access (COPILOT_GITHUB_TOKEN / GH_TOKEN)',
    }),
    model: z.string().optional().default('gpt-4o').openapi({
      description: 'Copilot model ID (gpt-4o, gpt-4o-mini, claude-sonnet-4-5, o3-mini, ...)',
    }),
  })
  .openapi('CopilotConfig');

export const ProviderSwitchSchema = z
  .object({
    provider: ProviderEnum,
  })
  .openapi('ProviderSwitch');

export const OpenAIConfigSchema = z
  .object({
    api_key: z.string().optional().default('').openapi({
      description: 'OpenAI API key (sk-...)',
    }),
    model: z.string().optional().default('gpt-4o').openapi({
      description: 'OpenAI model ID',
    }),
  })
  .openapi('OpenAIConfig');

export const BedrockConfigSchema = z
  .object({
    access_key: z.string().optional().default(''),
    secret_key: z.string().optional().default(''),
    region: z.string().optional().default('us-east-1'),
    model: z
      .string()
      .optional()
      .default('anthropic.claude-3-5-sonnet-20241022-v2:0'),
  })
  .openapi('BedrockConfig');

// ─── Responses ───────────────────────────────────────────

export const SetupResponseSchema = z
  .object({
    status: z.string(),
    owner: z.string(),
    repo: z.string(),
    max_scan_limit: z.number().int(),
    note: z.string(),
  })
  .openapi('SetupResponse');

export const ConfigStatusSchema = z
  .object({
    repo: z
      .object({
        owner: z.string(),
        repo: z.string(),
        branch: z.string().nullable().optional(),
      })
      .nullable(),
    ai_provider: ProviderEnum,
    has_gemini_key: z.boolean(),
    gemini_key_source: z.enum(['env', 'ui', 'none']),
    gemini_model: z.string(),
    has_github_token: z.boolean(),
    ollama_url: z.string().nullable(),
    ollama_model: z.string(),
    has_copilot_token: z.boolean(),
    copilot_key_source: z.enum(['env', 'ui', 'none']),
    copilot_model: z.string(),
    has_openai_key: z.boolean(),
    openai_key_source: z.enum(['env', 'ui', 'none']),
    openai_model: z.string(),
    has_bedrock_key: z.boolean(),
    bedrock_key_source: z.enum(['env', 'ui', 'none']),
    bedrock_region: z.string(),
    bedrock_model: z.string(),
    kb_files: z.number().int(),
    kb_insights: z.number().int(),
    kb_has_summary: z.boolean(),
    total_sessions: z.number().int(),
    scan_status: z
      .object({
        running: z.boolean(),
        text: z.string(),
        progress: z.number().int(),
        error: z.boolean().optional(),
      })
      .nullable(),
    total_requests: z.number().int(),
    total_cost_usd: z.number(),
  })
  .openapi('ConfigStatus');

// ─── Type aliases ────────────────────────────────────────
export type SetupRequest = z.infer<typeof SetupRequestSchema>;
export type GeminiConfig = z.infer<typeof GeminiConfigSchema>;
export type OllamaConfig = z.infer<typeof OllamaConfigSchema>;
export type CopilotConfig = z.infer<typeof CopilotConfigSchema>;
export type ProviderSwitch = z.infer<typeof ProviderSwitchSchema>;
export type OpenAIConfig = z.infer<typeof OpenAIConfigSchema>;
export type BedrockConfig = z.infer<typeof BedrockConfigSchema>;
