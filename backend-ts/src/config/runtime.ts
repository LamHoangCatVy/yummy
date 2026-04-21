/**
 * Runtime-mutable provider configuration.
 * Mirrors Python's API_CONFIG dict — routers can mutate this at runtime
 * via /config/* endpoints. Initialized from env at boot.
 */
import { env } from './env.js';

export type Provider = 'gemini' | 'openai' | 'ollama' | 'copilot' | 'bedrock';

export interface RuntimeConfig {
  gemini_key: string;
  gemini_model: string;
  ollama_base_url: string;
  ollama_model: string;
  copilot_token: string;
  copilot_model: string;
  openai_key: string;
  openai_model: string;
  bedrock_access_key: string;
  bedrock_secret_key: string;
  bedrock_region: string;
  bedrock_model: string;
  provider: Provider;
}

export const runtimeConfig: RuntimeConfig = {
  gemini_key: env.GEMINI_API_KEY,
  gemini_model: env.GEMINI_MODEL,
  ollama_base_url: env.OLLAMA_BASE_URL,
  ollama_model: env.OLLAMA_MODEL,
  copilot_token: env.COPILOT_GITHUB_TOKEN || env.GH_TOKEN || env.GITHUB_TOKEN,
  copilot_model: env.COPILOT_MODEL,
  openai_key: env.OPENAI_API_KEY,
  openai_model: env.OPENAI_MODEL,
  bedrock_access_key: env.AWS_ACCESS_KEY_ID,
  bedrock_secret_key: env.AWS_SECRET_ACCESS_KEY,
  bedrock_region: env.AWS_REGION,
  bedrock_model: env.BEDROCK_MODEL,
  provider: env.AI_PROVIDER,
};

/** Snapshot of env-time defaults — used by /config/status `_key_source` detection. */
export const envDefaults: Readonly<RuntimeConfig> = Object.freeze({
  ...runtimeConfig,
});
