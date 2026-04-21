/**
 * Sessions repository.
 * Mirrors Python's DB["sessions"] dict with the make_session() shape.
 */
import { eq } from 'drizzle-orm';
import { db } from '../client.js';
import { sessions, type SessionRow } from '../schema.js';
import { nowIso } from '../../lib/time.js';

export type Session = SessionRow;

function defaultSystemLog(name: string): Session['logs'][number] {
  return {
    role: 'system',
    text: `⚡ YUMMY\nWorkspace: ${name}\nType /help to see available commands.`,
  };
}

export const sessionsRepo = {
  list(): Session[] {
    return db.select().from(sessions).all();
  },

  get(id: string): Session | undefined {
    return db.select().from(sessions).where(eq(sessions.id, id)).get();
  },

  create(id: string, name: string): Session {
    const row: Session = {
      id,
      name,
      createdAt: nowIso(),
      logs: [defaultSystemLog(name)],
      chatHistory: [],
      agentOutputs: {},
      jiraBacklog: [],
      metrics: { tokens: 0 },
      workflowState: 'idle',
    };
    db.insert(sessions).values(row).run();
    return row;
  },

  update(id: string, patch: Partial<Omit<Session, 'id'>>): Session | undefined {
    if (Object.keys(patch).length === 0) return this.get(id);
    db.update(sessions).set(patch).where(eq(sessions.id, id)).run();
    return this.get(id);
  },

  delete(id: string): boolean {
    const res = db.delete(sessions).where(eq(sessions.id, id)).run();
    return res.changes > 0;
  },

  /** Reset agent outputs / jira backlog / workflow state — keeps logs + chat. */
  reset(id: string): Session | undefined {
    return this.update(id, {
      agentOutputs: {},
      jiraBacklog: [],
      workflowState: 'idle',
    });
  },
};
