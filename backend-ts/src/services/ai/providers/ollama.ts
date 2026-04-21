/**
 * Ollama provider — blocking + streaming via the official `ollama` npm package.
 *
 * Note: a fresh `Ollama` instance is created per request so the request can be
 * aborted independently. (`abort()` cancels all requests on the instance.)
 */
import { Ollama } from 'ollama';
import { runtimeConfig } from '../../../config/runtime.js';
import { HttpError } from '../../../lib/errors.js';
import type { CallResult, StreamChunks } from './types.js';

function host(): string {
  return runtimeConfig.ollama_base_url || 'http://localhost:11434';
}

function model(): string {
  return runtimeConfig.ollama_model || 'llama3';
}

function makeClient(): Ollama {
  return new Ollama({ host: host() });
}

export async function callOllama(
  _agentRole: string,
  prompt: string,
  instruction: string,
): Promise<CallResult> {
  const m = model();
  try {
    const resp = await makeClient().chat({
      model: m,
      stream: false,
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: prompt },
      ],
    });
    return {
      text: resp.message?.content ?? '',
      inTokens: resp.prompt_eval_count ?? null,
      outTokens: resp.eval_count ?? null,
    };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(
      502,
      `Ollama error: ${(e as Error).message}\n` +
        `Make sure Ollama is running (\`ollama serve\`) and the model is pulled (\`ollama pull ${m}\`).`,
    );
  }
}

export async function* streamOllama(
  prompt: string,
  instruction: string,
): StreamChunks {
  const m = model();
  let iterator: AsyncIterable<{ message?: { content?: string } }>;
  try {
    iterator = await makeClient().chat({
      model: m,
      stream: true,
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: prompt },
      ],
    });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, `Ollama stream error: ${(e as Error).message}`);
  }

  try {
    for await (const event of iterator) {
      const token = event.message?.content;
      if (token) yield token;
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, `Ollama stream error: ${(e as Error).message}`);
  }
}
