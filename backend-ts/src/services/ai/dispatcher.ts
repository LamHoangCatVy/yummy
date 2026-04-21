/**
 * AI dispatcher — selects provider from runtimeConfig.provider and tracks usage.
 *
 * Mirrors backend/services/ai_service.py `call_ai` and `stream_ai`.
 */
import { runtimeConfig } from '../../config/runtime.js';
import { callBedrock, streamBedrock } from './providers/bedrock.js';
import { callCopilot, streamCopilot } from './providers/copilot.js';
import { callGemini, streamGemini } from './providers/gemini.js';
import { callOllama, streamOllama } from './providers/ollama.js';
import { callOpenAI, streamOpenAI } from './providers/openai.js';
import type { CallResult, StreamChunks } from './providers/types.js';
import { track } from './track.js';

/**
 * Blocking AI call. Selects provider from runtimeConfig.provider.
 * Tracks token usage and cost via logsRepo.
 */
export async function callAI(
  agentRole: string,
  prompt: string,
  instruction: string,
): Promise<string> {
  const provider = runtimeConfig.provider;
  const start = Date.now();

  let result: CallResult;
  switch (provider) {
    case 'gemini':
      result = await callGemini(agentRole, prompt, instruction);
      break;
    case 'openai':
      result = await callOpenAI(agentRole, prompt, instruction);
      break;
    case 'ollama':
      result = await callOllama(agentRole, prompt, instruction);
      break;
    case 'copilot':
      result = await callCopilot(agentRole, prompt, instruction);
      break;
    case 'bedrock':
      result = await callBedrock(agentRole, prompt, instruction);
      break;
    default:
      result = await callGemini(agentRole, prompt, instruction);
  }

  track({
    agentRole,
    prompt,
    instruction,
    resultText: result.text,
    latencySeconds: (Date.now() - start) / 1000,
    inTokens: result.inTokens,
    outTokens: result.outTokens,
  });

  return result.text;
}

/**
 * Streaming AI call — yields text chunks as they arrive.
 * All providers support true token-by-token streaming.
 *
 * NOTE: Streaming does not currently call `track()` (matches Python parity —
 * `stream_ai` in Python also does not record metrics). Consumers wanting to
 * record usage from a streamed response must call `track()` themselves once
 * the stream is fully drained.
 */
export async function* streamAI(
  prompt: string,
  instruction: string,
): StreamChunks {
  const provider = runtimeConfig.provider;
  const iterator =
    provider === 'gemini'
      ? streamGemini(prompt, instruction)
      : provider === 'openai'
        ? streamOpenAI(prompt, instruction)
        : provider === 'ollama'
          ? streamOllama(prompt, instruction)
          : provider === 'copilot'
            ? streamCopilot(prompt, instruction)
            : provider === 'bedrock'
              ? streamBedrock(prompt, instruction)
              : streamGemini(prompt, instruction);

  for await (const chunk of iterator) {
    yield chunk;
  }
}
