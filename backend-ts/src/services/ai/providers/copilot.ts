/**
 * GitHub Copilot provider — blocking + streaming.
 *
 * Implementation note (divergence from Python):
 *   The Python backend used the `github-copilot-sdk` Python package's
 *   event-driven session API. The Node-side `@github/copilot-sdk` v0.2.2 is
 *   only a CLI shim — there's no programmatic JS API.
 *
 *   We therefore call the Copilot Chat REST API directly via the `openai` SDK
 *   pointed at https://api.githubcopilot.com. This is the standard JS path and
 *   preserves request/response semantics (text in → text out, streaming SSE).
 *
 *   The `copilot_token` from runtime config is used as the bearer token
 *   (a GitHub token with Copilot access — same env var COPILOT_GITHUB_TOKEN).
 */
import OpenAI from 'openai';
import { runtimeConfig } from '../../../config/runtime.js';
import { HttpError } from '../../../lib/errors.js';
import type { CallResult, StreamChunks } from './types.js';

const COPILOT_BASE_URL = 'https://api.githubcopilot.com';

function token(): string {
  const t = runtimeConfig.copilot_token;
  if (!t) {
    throw new HttpError(
      400,
      'COPILOT_GITHUB_TOKEN is not configured. Set it in Settings or via the COPILOT_GITHUB_TOKEN env var.',
    );
  }
  return t;
}

function model(): string {
  return runtimeConfig.copilot_model || 'gpt-4o';
}

function client(): OpenAI {
  return new OpenAI({
    apiKey: token(),
    baseURL: COPILOT_BASE_URL,
    timeout: 300_000,
    defaultHeaders: {
      'Editor-Version': 'yummy-backend/1.0',
      'Copilot-Integration-Id': 'vscode-chat',
    },
  });
}

export async function callCopilot(
  _agentRole: string,
  prompt: string,
  instruction: string,
): Promise<CallResult> {
  try {
    const resp = await client().chat.completions.create({
      model: model(),
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: prompt },
      ],
    });
    const text = resp.choices[0]?.message?.content ?? '';
    const usage = resp.usage;
    return {
      text,
      inTokens: usage?.prompt_tokens ?? null,
      outTokens: usage?.completion_tokens ?? null,
    };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, `Copilot error: ${(e as Error).message}`);
  }
}

export async function* streamCopilot(
  prompt: string,
  instruction: string,
): StreamChunks {
  let stream: AsyncIterable<{
    choices?: Array<{ delta?: { content?: string | null } }>;
  }>;
  try {
    stream = (await client().chat.completions.create({
      model: model(),
      stream: true,
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: prompt },
      ],
    })) as unknown as AsyncIterable<{
      choices?: Array<{ delta?: { content?: string | null } }>;
    }>;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, `Copilot stream error: ${(e as Error).message}`);
  }

  try {
    for await (const event of stream) {
      const token = event.choices?.[0]?.delta?.content;
      if (token) yield token;
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, `Copilot stream error: ${(e as Error).message}`);
  }
}
