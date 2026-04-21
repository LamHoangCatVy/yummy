/**
 * OpenAI provider — blocking + streaming via the official `openai` SDK.
 */
import OpenAI from 'openai';
import { runtimeConfig } from '../../../config/runtime.js';
import { HttpError } from '../../../lib/errors.js';
import type { CallResult, StreamChunks } from './types.js';

function client(): OpenAI {
  const key = runtimeConfig.openai_key;
  if (!key) {
    throw new HttpError(
      400,
      'OPENAI_API_KEY is not configured. Set it in Settings or via the OPENAI_API_KEY env var.',
    );
  }
  return new OpenAI({ apiKey: key, timeout: 300_000 });
}

function model(): string {
  return runtimeConfig.openai_model || 'gpt-4o';
}

export async function callOpenAI(
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
    const status = (e as { status?: number }).status;
    throw new HttpError(
      502,
      `OpenAI error${status ? ` ${status}` : ''}: ${(e as Error).message}`,
    );
  }
}

export async function* streamOpenAI(
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
    throw new HttpError(502, `OpenAI stream error: ${(e as Error).message}`);
  }

  try {
    for await (const event of stream) {
      const token = event.choices?.[0]?.delta?.content;
      if (token) yield token;
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, `OpenAI stream error: ${(e as Error).message}`);
  }
}
