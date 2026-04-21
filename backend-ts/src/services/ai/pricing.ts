/**
 * Per-provider pricing (USD per 1M tokens, April 2026).
 * Ported verbatim from backend/services/ai_service.py PRICING table.
 */
import type { Provider } from '../../config/runtime.js';

export interface PriceEntry {
  in: number;
  out: number;
}

export const PRICING: Record<string, PriceEntry> = {
  // Gemini
  'gemini-2.5-pro': { in: 1.25, out: 10.0 },
  'gemini-2.5-flash': { in: 0.075, out: 0.3 },
  'gemini-2.5-flash-lite': { in: 0.025, out: 0.1 },
  'gemini-3.1-flash-preview': { in: 0.075, out: 0.3 },
  // OpenAI GPT-5 family
  'gpt-5.2': { in: 1.75, out: 14.0 },
  'gpt-5.1': { in: 1.25, out: 10.0 },
  'gpt-5': { in: 1.25, out: 10.0 },
  'gpt-5-mini': { in: 0.25, out: 2.0 },
  'gpt-5-nano': { in: 0.05, out: 0.4 },
  // OpenAI GPT-4.1 family
  'gpt-4.1': { in: 2.0, out: 8.0 },
  'gpt-4.1-mini': { in: 0.4, out: 1.6 },
  'gpt-4.1-nano': { in: 0.1, out: 0.4 },
  // OpenAI legacy
  'gpt-4o': { in: 2.5, out: 10.0 },
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  // OpenAI o-series
  o1: { in: 15.0, out: 60.0 },
  'o1-mini': { in: 1.1, out: 4.4 },
  o3: { in: 2.0, out: 8.0 },
  'o3-mini': { in: 0.5, out: 2.0 },
  'o4-mini': { in: 1.1, out: 4.4 },
  // Bedrock — Anthropic Claude
  'anthropic.claude-opus-4-6-v1:0': { in: 15.0, out: 75.0 },
  'anthropic.claude-sonnet-4-5-v1:0': { in: 3.0, out: 15.0 },
  'anthropic.claude-3-5-sonnet-20241022-v2:0': { in: 3.0, out: 15.0 },
  'anthropic.claude-3-5-haiku-20241022-v1:0': { in: 0.8, out: 4.0 },
  'anthropic.claude-3-haiku-20240307-v1:0': { in: 0.25, out: 1.25 },
  // Bedrock — Amazon Nova
  'amazon.nova-premier-v1:0': { in: 2.0, out: 15.0 },
  'amazon.nova-pro-v1:0': { in: 0.8, out: 3.2 },
  'amazon.nova-lite-v1:0': { in: 0.06, out: 0.24 },
  'amazon.nova-micro-v1:0': { in: 0.035, out: 0.14 },
  // Bedrock — Meta Llama
  'meta.llama4-maverick-17b-instruct-v1:0': { in: 0.24, out: 0.97 },
  'meta.llama4-scout-17b-instruct-v1:0': { in: 0.17, out: 0.66 },
  'meta.llama3-70b-instruct-v1:0': { in: 0.99, out: 0.99 },
  // Bedrock — Mistral
  'mistral.mistral-large-2-v1:0': { in: 3.0, out: 9.0 },
  // Copilot models (billed per seat — proxy pricing for display)
  'gpt-5-codex': { in: 1.25, out: 10.0 },
  'claude-opus-4-6': { in: 15.0, out: 75.0 },
  'claude-sonnet-4-5': { in: 3.0, out: 15.0 },
};

const DEFAULTS: Record<Provider, PriceEntry> = {
  gemini: { in: 0.075, out: 0.3 },
  openai: { in: 1.25, out: 10.0 },
  bedrock: { in: 3.0, out: 15.0 },
  copilot: { in: 1.25, out: 10.0 },
  ollama: { in: 0.0, out: 0.0 },
};

export function getPrice(provider: Provider, model: string): PriceEntry {
  return PRICING[model] ?? DEFAULTS[provider] ?? { in: 0.0, out: 0.0 };
}

/** Matches Python `_estimate_tokens(text) = max(1, len(text) // 4)`. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.floor(text.length / 4));
}
