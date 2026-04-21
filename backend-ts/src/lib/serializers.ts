/**
 * Serializers: convert internal Drizzle rows (camelCase) → API DTOs (snake_case).
 *
 * The frontend expects snake_case keys identical to the Python backend.
 * Centralizing this avoids snake_case leaking into our domain code.
 */
import type { Session } from '../db/repositories/sessions.repo.js';
import type { RepoInfo } from '../db/repositories/repo.repo.js';
import type {
  SessionDetail,
  SessionSummary,
} from '../schemas/sessions.schema.js';

export function toSessionDetail(s: Session): SessionDetail {
  return {
    id: s.id,
    name: s.name,
    created_at: s.createdAt,
    logs: s.logs,
    chat_history: s.chatHistory as SessionDetail['chat_history'],
    agent_outputs: s.agentOutputs as Record<string, unknown>,
    jira_backlog: s.jiraBacklog,
    metrics: s.metrics,
    workflow_state: s.workflowState,
  };
}

export function toSessionSummary(s: Session): SessionSummary {
  return {
    id: s.id,
    name: s.name,
    created_at: s.createdAt,
    workflow_state: s.workflowState,
  };
}

export function toRepoDto(r: RepoInfo) {
  return {
    owner: r.owner,
    repo: r.repo,
    branch: r.branch ?? null,
  };
}
