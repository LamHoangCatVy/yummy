/**
 * Guard helpers — TypeScript port of backend/dependencies.py.
 * Each throws an HttpError that the global error handler converts to {detail}.
 */
import { badRequest, notFound } from './errors.js';
import { kbRepo } from '../db/repositories/kb.repo.js';
import { repoRepo, type RepoInfo } from '../db/repositories/repo.repo.js';
import { sessionsRepo, type Session } from '../db/repositories/sessions.repo.js';

/** Fetch a session or 404. Mirrors get_session(session_id). */
export function requireSession(sessionId: string): Session {
  const s = sessionsRepo.get(sessionId);
  if (!s) {
    throw notFound(
      `Session '${sessionId}' not found. Create one via POST /sessions.`,
    );
  }
  return s;
}

/** Throw 400 if no GitHub repo configured. Mirrors require_repo(). */
export function requireRepo(): RepoInfo {
  const r = repoRepo.get();
  if (!r) {
    throw badRequest(
      'GitHub repo not configured. Call POST /config/setup first.',
    );
  }
  return r;
}

/** Throw 400 if KB has no insights yet. Mirrors require_knowledge_base(). */
export function requireKnowledgeBase() {
  if (kbRepo.isEmpty()) {
    throw badRequest(
      'Knowledge base is empty. Call POST /kb/scan and wait for it to complete.',
    );
  }
  return kbRepo.snapshot();
}

/** Throw 400 if session.workflowState !== expected. Mirrors require_workflow_state(). */
export function requireWorkflowState(session: Session, expected: string): void {
  if (session.workflowState !== expected) {
    throw badRequest(
      `Current workflow state is '${session.workflowState}', ` +
        `but '${expected}' is required to perform this step.`,
    );
  }
}
