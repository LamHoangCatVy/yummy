import { describe, expect, it, beforeAll, beforeEach } from 'vitest';

process.env.DATABASE_URL = ':memory:';

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolve } from 'node:path';

import { db } from '../../src/db/client.js';
import { sessionsRepo } from '../../src/db/repositories/sessions.repo.js';
import { repoRepo } from '../../src/db/repositories/repo.repo.js';
import { kbRepo } from '../../src/db/repositories/kb.repo.js';
import {
  requireSession,
  requireRepo,
  requireKnowledgeBase,
  requireWorkflowState,
} from '../../src/lib/guards.js';
import { HttpError } from '../../src/lib/errors.js';

beforeAll(() => {
  migrate(db, { migrationsFolder: resolve(__dirname, '../../src/db/migrations') });
});

beforeEach(() => {
  // wipe between tests
  for (const s of sessionsRepo.list()) sessionsRepo.delete(s.id);
  repoRepo.clear();
  kbRepo.resetAll();
});

describe('guards', () => {
  it('requireSession throws 404 with FastAPI-style detail', () => {
    try {
      requireSession('nope');
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(404);
      expect((e as HttpError).detail).toContain("Session 'nope' not found");
    }
  });

  it('requireSession returns the session when present', () => {
    sessionsRepo.create('s1', 'WS');
    expect(requireSession('s1').id).toBe('s1');
  });

  it('requireRepo throws 400 when not configured', () => {
    expect(() => requireRepo()).toThrowError(/GitHub repo not configured/);
  });

  it('requireKnowledgeBase throws 400 when empty', () => {
    expect(() => requireKnowledgeBase()).toThrowError(/Knowledge base is empty/);
  });

  it('requireKnowledgeBase passes when insights exist', () => {
    kbRepo.addInsight({ id: 1, files: ['a.ts'], summary: 's', createdAt: 1 });
    const kb = requireKnowledgeBase();
    expect(kb.insights).toHaveLength(1);
  });

  it('requireWorkflowState throws 400 on mismatch', () => {
    const s = sessionsRepo.create('s2', 'WS');
    expect(() => requireWorkflowState(s, 'waiting_ba_approval')).toThrowError(
      /Current workflow state is 'idle'/,
    );
  });

  it('requireWorkflowState passes on match', () => {
    const s = sessionsRepo.create('s3', 'WS');
    expect(() => requireWorkflowState(s, 'idle')).not.toThrow();
  });
});
