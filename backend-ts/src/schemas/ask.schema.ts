/**
 * Ask / RAG schemas — for /ask, /ask/free, /ask/sync.
 */
import { z } from '@hono/zod-openapi';

export const AskRequestSchema = z
  .object({
    session_id: z.string().min(1),
    question: z.string().min(1),
    ide_file: z.string().optional().default('').openapi({
      description: 'Path of the file currently open in the IDE Simulator',
    }),
    ide_content: z.string().optional().default('').openapi({
      description: 'Content of the file currently open in the IDE Simulator',
    }),
  })
  .openapi('AskRequest');

export const AskSyncResponseSchema = z
  .object({
    question: z.string(),
    answer: z.string(),
    trace: z.unknown(),
    session_id: z.string(),
  })
  .openapi('AskSyncResponse');

export type AskRequest = z.infer<typeof AskRequestSchema>;
