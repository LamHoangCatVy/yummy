/**
 * Request tracker — writes a row into request_logs.
 * Mirrors Python `_track` in backend/services/ai_service.py.
 */
import { runtimeConfig } from '../../config/runtime.js';
import { logsRepo } from '../../db/repositories/logs.repo.js';
import { nowHms } from '../../lib/time.js';
import { estimateTokens, getPrice } from './pricing.js';

export interface TrackArgs {
  agentRole: string;
  prompt: string;
  instruction: string;
  resultText: string;
  /** Latency in seconds (matches Python `time.time() - start`). */
  latencySeconds: number;
  inTokens?: number | null | undefined;
  outTokens?: number | null | undefined;
}

export function track(args: TrackArgs): void {
  const inTokens =
    args.inTokens ?? estimateTokens(args.prompt + args.instruction);
  const outTokens = args.outTokens ?? estimateTokens(args.resultText);

  const provider = runtimeConfig.provider;
  const modelKey = `${provider}_model` as const;
  const model = (runtimeConfig as unknown as Record<string, string>)[modelKey] ?? '';
  const price = getPrice(provider, model);
  const cost =
    (inTokens / 1_000_000) * price.in + (outTokens / 1_000_000) * price.out;

  logsRepo.add({
    id: Date.now(),
    time: nowHms(),
    agent: args.agentRole,
    provider,
    model,
    inTokens,
    outTokens,
    latency: round(args.latencySeconds, 2),
    cost: round(cost, 6),
  });
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
