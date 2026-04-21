/**
 * SDLC schemas — change request + approval + state response.
 */
import { z } from '@hono/zod-openapi';

export const CRRequestSchema = z
  .object({
    session_id: z.string().min(1),
    requirement: z.string().min(1).openapi({
      description: 'Change Request / feature requirement',
    }),
  })
  .openapi('CRRequest');

export const ApproveRequestSchema = z
  .object({
    session_id: z.string().min(1),
    edited_content: z.string().nullable().optional().openapi({
      description:
        'If the user wants to edit the agent output before approving, pass the edited content here',
    }),
  })
  .openapi('ApproveRequest');

export const SDLCStateResponseSchema = z
  .object({
    session_id: z.string(),
    workflow_state: z.string(),
    agent_outputs: z.record(z.string(), z.unknown()),
    jira_backlog: z.array(z.unknown()),
  })
  .openapi('SDLCStateResponse');

export type CRRequest = z.infer<typeof CRRequestSchema>;
export type ApproveRequest = z.infer<typeof ApproveRequestSchema>;
