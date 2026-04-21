import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

process.env.DATABASE_URL = ':memory:';

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolve } from 'node:path';

import { runtimeConfig } from '../../src/config/runtime.js';
import { db } from '../../src/db/client.js';
import { logsRepo } from '../../src/db/repositories/logs.repo.js';
import { estimateTokens, getPrice, PRICING } from '../../src/services/ai/pricing.js';
import { track } from '../../src/services/ai/track.js';

beforeAll(() => {
  migrate(db, {
    migrationsFolder: resolve(__dirname, '../../src/db/migrations'),
  });
});

beforeEach(() => {
  logsRepo.clear();
});

describe('pricing', () => {
  it('returns the per-1M-token rate for known models', () => {
    expect(PRICING['gpt-4o']).toEqual({ in: 2.5, out: 10.0 });
    expect(getPrice('openai', 'gpt-4o')).toEqual({ in: 2.5, out: 10.0 });
  });

  it('falls back to provider defaults for unknown models', () => {
    expect(getPrice('gemini', 'gemini-9-future')).toEqual({
      in: 0.075,
      out: 0.3,
    });
    expect(getPrice('ollama', 'whatever')).toEqual({ in: 0, out: 0 });
  });
});

describe('estimateTokens', () => {
  it('matches Python max(1, len(text) // 4)', () => {
    expect(estimateTokens('')).toBe(1);
    expect(estimateTokens('abc')).toBe(1); // floor(3/4) = 0 -> max 1
    expect(estimateTokens('abcd')).toBe(1); // floor(4/4) = 1
    expect(estimateTokens('abcdefgh')).toBe(2);
    expect(estimateTokens('a'.repeat(100))).toBe(25);
  });
});

describe('track', () => {
  it('writes a log row using current runtime provider/model', () => {
    runtimeConfig.provider = 'openai';
    runtimeConfig.openai_model = 'gpt-4o-mini';

    track({
      agentRole: 'INDEXER',
      prompt: 'a'.repeat(40),
      instruction: 'b'.repeat(40),
      resultText: 'c'.repeat(80),
      latencySeconds: 1.234,
      inTokens: 100,
      outTokens: 200,
    });

    const rows = logsRepo.list();
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.agent).toBe('INDEXER');
    expect(row.provider).toBe('openai');
    expect(row.model).toBe('gpt-4o-mini');
    expect(row.inTokens).toBe(100);
    expect(row.outTokens).toBe(200);
    expect(row.latency).toBe(1.23);
    // gpt-4o-mini: in 0.15, out 0.60 per 1M
    // cost = 100/1e6 * 0.15 + 200/1e6 * 0.60 = 0.000015 + 0.00012 = 0.000135
    expect(row.cost).toBeCloseTo(0.000135, 6);
  });

  it('estimates tokens when provider does not return usage', () => {
    runtimeConfig.provider = 'gemini';
    runtimeConfig.gemini_model = 'gemini-2.5-flash';

    track({
      agentRole: 'AGENT_X',
      prompt: 'a'.repeat(80), // 20 tokens
      instruction: 'b'.repeat(80), // combined 160 chars -> 40 tokens
      resultText: 'c'.repeat(40), // 10 tokens
      latencySeconds: 0.5,
    });

    const row = logsRepo.list()[0]!;
    expect(row.inTokens).toBe(40);
    expect(row.outTokens).toBe(10);
  });

  it('newest log appears first via list()', async () => {
    runtimeConfig.provider = 'gemini';
    track({
      agentRole: 'first',
      prompt: 'p',
      instruction: 'i',
      resultText: 'r',
      latencySeconds: 0,
      inTokens: 1,
      outTokens: 1,
    });
    await new Promise((r) => setTimeout(r, 5));
    track({
      agentRole: 'second',
      prompt: 'p',
      instruction: 'i',
      resultText: 'r',
      latencySeconds: 0,
      inTokens: 1,
      outTokens: 1,
    });

    const rows = logsRepo.list();
    expect(rows[0]?.agent).toBe('second');
    expect(rows[1]?.agent).toBe('first');
  });
});
