/**
 * Knowledge base schemas — for /kb/* responses + scan status.
 */
import { z } from '@hono/zod-openapi';

export const TreeEntrySchema = z
  .object({
    path: z.string(),
    name: z.string(),
    status: z.string().openapi({ example: 'pending' }),
  })
  .openapi('TreeEntry');

export const InsightSchema = z
  .object({
    id: z.number().int(),
    files: z.array(z.string()),
    summary: z.string(),
  })
  .openapi('Insight');

export const KnowledgeBaseSchema = z
  .object({
    file_count: z.number().int(),
    insight_count: z.number().int(),
    has_summary: z.boolean(),
    tree: z.array(TreeEntrySchema),
    insights: z.array(InsightSchema),
    project_summary: z.string(),
  })
  .openapi('KnowledgeBase');

export const ScanStatusResponseSchema = z
  .object({
    running: z.boolean(),
    text: z.string(),
    progress: z.number().int().default(0),
    error: z.boolean().optional().default(false),
  })
  .openapi('ScanStatusResponse');

export const FileContentSchema = z
  .object({
    path: z.string(),
    content: z.string(),
    branch: z.string(),
    repo: z.string(),
  })
  .openapi('FileContent');

export const FileQuerySchema = z.object({
  path: z.string().min(1).openapi({ example: 'src/main.py' }),
});

export type ScanStatusResponse = z.infer<typeof ScanStatusResponseSchema>;
