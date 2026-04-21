/**
 * AWS Bedrock provider — blocking + true token streaming via the Converse API.
 * Uses @aws-sdk/client-bedrock-runtime ConverseCommand / ConverseStreamCommand.
 */
import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { runtimeConfig } from '../../../config/runtime.js';
import { HttpError } from '../../../lib/errors.js';
import type { CallResult, StreamChunks } from './types.js';

function makeClient(): BedrockRuntimeClient {
  const accessKeyId = runtimeConfig.bedrock_access_key;
  const secretAccessKey = runtimeConfig.bedrock_secret_key;
  const region = runtimeConfig.bedrock_region || 'us-east-1';

  if (!accessKeyId || !secretAccessKey) {
    throw new HttpError(
      400,
      'AWS credentials not configured. Set them in Settings or via AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars.',
    );
  }

  return new BedrockRuntimeClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function model(): string {
  return runtimeConfig.bedrock_model || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
}

export async function callBedrock(
  _agentRole: string,
  prompt: string,
  instruction: string,
): Promise<CallResult> {
  const m = model();
  try {
    const resp = await makeClient().send(
      new ConverseCommand({
        modelId: m,
        system: [{ text: instruction }],
        messages: [{ role: 'user', content: [{ text: prompt }] }],
      }),
    );

    const text = resp.output?.message?.content?.[0]?.text ?? '';
    return {
      text,
      inTokens: resp.usage?.inputTokens ?? null,
      outTokens: resp.usage?.outputTokens ?? null,
    };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, `AWS Bedrock error: ${(e as Error).message}`);
  }
}

export async function* streamBedrock(
  prompt: string,
  instruction: string,
): StreamChunks {
  const m = model();
  let response: Awaited<ReturnType<BedrockRuntimeClient['send']>> & {
    stream?: AsyncIterable<{
      contentBlockDelta?: { delta?: { text?: string } };
    }>;
  };
  try {
    response = (await makeClient().send(
      new ConverseStreamCommand({
        modelId: m,
        system: [{ text: instruction }],
        messages: [{ role: 'user', content: [{ text: prompt }] }],
      }),
    )) as never;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, `AWS Bedrock stream error: ${(e as Error).message}`);
  }

  const stream = response.stream;
  if (!stream) return;

  try {
    for await (const event of stream) {
      const delta = event.contentBlockDelta?.delta?.text;
      if (delta) yield delta;
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, `AWS Bedrock stream error: ${(e as Error).message}`);
  }
}
