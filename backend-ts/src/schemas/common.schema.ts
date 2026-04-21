/**
 * Common Zod schemas — shared across modules.
 * Uses @hono/zod-openapi so schemas double as request validators + OpenAPI docs.
 *
 * IMPORTANT: All field names preserve snake_case (matching Python/Pydantic) for
 * frontend parity. Do NOT auto-camelCase.
 */
import { z } from '@hono/zod-openapi';

// ─── Universal error envelope ────────────────────────────
export const ErrorSchema = z
  .object({
    detail: z.string().openapi({ example: 'Something went wrong' }),
  })
  .openapi('Error');

export type ErrorResponse = z.infer<typeof ErrorSchema>;

// ─── Generic OK ack ──────────────────────────────────────
export const OkSchema = z
  .object({
    status: z.string().openapi({ example: 'ok' }),
  })
  .openapi('Ok');
