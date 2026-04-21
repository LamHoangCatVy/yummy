/**
 * Metrics router — /metrics.
 * Mirrors backend/routers/metrics_router.py.
 *
 * GET aggregates request_logs by agent and returns the 50 most recent rows.
 * DELETE clears all logs.
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { logsRepo } from '../db/repositories/logs.repo.js';
import {
  MetricsResponseSchema,
  type RequestLogDto,
} from '../schemas/metrics.schema.js';

export const metricsRouter = new OpenAPIHono();

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  'application/json': { schema },
});

interface AgentStats {
  calls: number;
  cost: number;
  total_tokens: number;
}

// ─── GET /metrics ────────────────────────────────────────
metricsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/metrics',
    tags: ['Metrics'],
    responses: {
      200: { content: json(MetricsResponseSchema), description: 'Metrics' },
    },
  }),
  (c) => {
    const logs = logsRepo.list(); // newest-first
    const totalCost = round(
      logs.reduce((sum, l) => sum + l.cost, 0),
      6,
    );

    const breakdown: Record<string, AgentStats> = {};
    for (const log of logs) {
      const a = log.agent;
      const stats = (breakdown[a] ??= { calls: 0, cost: 0, total_tokens: 0 });
      stats.calls += 1;
      stats.cost += log.cost;
      stats.total_tokens += log.inTokens + log.outTokens;
    }

    const dtoLogs: RequestLogDto[] = logs.slice(0, 50).map((l) => ({
      id: l.id,
      time: l.time,
      agent: l.agent,
      provider: l.provider,
      model: l.model,
      in_tokens: l.inTokens,
      out_tokens: l.outTokens,
      latency: l.latency,
      cost: l.cost,
    }));

    return c.json({
      total_requests: logs.length,
      total_cost_usd: totalCost,
      agent_breakdown: breakdown,
      logs: dtoLogs,
    });
  },
);

// ─── DELETE /metrics ─────────────────────────────────────
metricsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/metrics',
    tags: ['Metrics'],
    responses: {
      200: {
        content: json(z.object({ status: z.string(), message: z.string() })),
        description: 'Cleared',
      },
    },
  }),
  (c) => {
    logsRepo.clear();
    return c.json({ status: 'ok', message: 'Request logs cleared.' });
  },
);

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
