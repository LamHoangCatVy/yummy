/**
 * Sessions schemas — mirrors NewSessionRequest + session entity.
 */
import { z } from '@hono/zod-openapi';

export const NewSessionRequestSchema = z
  .object({
    name: z.string().nullable().optional().openapi({
      description: 'Workspace/session name',
    }),
  })
  .openapi('NewSessionRequest');

export const SessionLogSchema = z.object({
  role: z.string(),
  text: z.string(),
});

// Python chat_history items: {role, text, trace?}
export const ChatMessageSchema = z.object({
  role: z.string(),
  text: z.string(),
  trace: z.unknown().optional(),
});

// Kept for backward-compat references in other schemas, but unused for session
// agent_outputs (Python stores them as raw strings).
export const AgentOutputSchema = z
  .object({
    agent: z.string(),
    content: z.string(),
    timestamp: z.string().nullable().optional(),
  })
  .openapi('AgentOutput');

export const SessionDetailSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    created_at: z.string(),
    logs: z.array(SessionLogSchema),
    chat_history: z.array(ChatMessageSchema),
    // agent_outputs stores arbitrary strings keyed by agent name (ba/sa/...)
    // plus 'requirement' for the original CR text. Python uses Dict[str, Any].
    agent_outputs: z.record(z.string(), z.unknown()),
    jira_backlog: z.array(z.unknown()),
    metrics: z.object({ tokens: z.number().int() }),
    workflow_state: z.string(),
  })
  .openapi('SessionDetail');

export const SessionSummarySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    created_at: z.string(),
    workflow_state: z.string(),
  })
  .openapi('SessionSummary');

export type NewSessionRequest = z.infer<typeof NewSessionRequestSchema>;
export type SessionDetail = z.infer<typeof SessionDetailSchema>;
export type SessionSummary = z.infer<typeof SessionSummarySchema>;
export type AgentOutputDto = z.infer<typeof AgentOutputSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
