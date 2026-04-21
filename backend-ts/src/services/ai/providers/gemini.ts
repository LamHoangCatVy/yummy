/**
 * Google Gemini provider — blocking + streaming.
 * Uses the official @google/genai SDK.
 */
import { GoogleGenAI } from '@google/genai';
import { runtimeConfig } from '../../../config/runtime.js';
import { HttpError } from '../../../lib/errors.js';
import type { CallResult, StreamChunks } from './types.js';

const DEFAULT_MODEL = 'gemini-2.5-flash';

function client(): GoogleGenAI {
  const key = runtimeConfig.gemini_key;
  if (!key) {
    throw new HttpError(
      400,
      'GEMINI_API_KEY is not configured. Set it in Settings or via the GEMINI_API_KEY env var.',
    );
  }
  return new GoogleGenAI({ apiKey: key });
}

function model(): string {
  return runtimeConfig.gemini_model || DEFAULT_MODEL;
}

export async function callGemini(
  _agentRole: string,
  prompt: string,
  instruction: string,
): Promise<CallResult> {
  try {
    const response = await client().models.generateContent({
      model: model(),
      contents: prompt,
      config: { systemInstruction: instruction },
    });
    const usage = response.usageMetadata;
    return {
      text: response.text ?? '',
      inTokens: usage?.promptTokenCount ?? null,
      outTokens: usage?.candidatesTokenCount ?? null,
    };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, `Gemini error: ${(e as Error).message}`);
  }
}

export async function* streamGemini(
  prompt: string,
  instruction: string,
): StreamChunks {
  let stream: AsyncGenerator<{ text?: string | undefined }, unknown, unknown>;
  try {
    stream = (await client().models.generateContentStream({
      model: model(),
      contents: prompt,
      config: { systemInstruction: instruction },
    })) as unknown as AsyncGenerator<
      { text?: string | undefined },
      unknown,
      unknown
    >;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, `Gemini stream error: ${(e as Error).message}`);
  }

  try {
    for await (const chunk of stream) {
      if (chunk.text) yield chunk.text;
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, `Gemini stream error: ${(e as Error).message}`);
  }
}
