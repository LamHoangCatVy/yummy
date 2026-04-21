/**
 * Metrics schemas.
 */
import { z } from '@hono/zod-openapi';

export const RequestLogSchema = z
  .object({
    id: z.number().int(),
    time: z.string(),
    agent: z.string(),
    provider: z.string(),
    model: z.string(),
    in_tokens: z.number().int(),
    out_tokens: z.number().int(),
    latency: z.number(),
    cost: z.number(),
  })
  .openapi('RequestLog');

export const AgentStatsSchema = z
  .object({
    calls: z.number().int(),
    cost: z.number(),
    total_tokens: z.number().int(),
  })
  .openapi('AgentStats');

export const MetricsResponseSchema = z
  .object({
    total_requests: z.number().int(),
    total_cost_usd: z.number(),
    agent_breakdown: z.record(z.string(), AgentStatsSchema),
    logs: z.array(RequestLogSchema),
  })
  .openapi('MetricsResponse');

export type RequestLogDto = z.infer<typeof RequestLogSchema>;
export type MetricsResponse = z.infer<typeof MetricsResponseSchema>;
