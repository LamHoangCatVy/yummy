import { describe, expect, it, beforeAll, beforeEach } from 'vitest';

// Use in-memory DB for tests
process.env.DATABASE_URL = ':memory:';

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolve } from 'node:path';

import { db } from '../../src/db/client.js';
import { sessionsRepo } from '../../src/db/repositories/sessions.repo.js';
import { kbRepo } from '../../src/db/repositories/kb.repo.js';
import { repoRepo } from '../../src/db/repositories/repo.repo.js';
import { scanStatusRepo } from '../../src/db/repositories/scan-status.repo.js';
import { logsRepo } from '../../src/db/repositories/logs.repo.js';

beforeAll(() => {
  migrate(db, { migrationsFolder: resolve(__dirname, '../../src/db/migrations') });
});

beforeEach(() => {
  for (const s of sessionsRepo.list()) sessionsRepo.delete(s.id);
  kbRepo.resetAll();
  repoRepo.clear();
  scanStatusRepo.clear();
  logsRepo.clear();
});

describe('sessionsRepo', () => {
  it('creates, gets, updates, resets, and deletes a session', () => {
    const s = sessionsRepo.create('s1', 'Workspace A');
    expect(s.id).toBe('s1');
    expect(s.workflowState).toBe('idle');
    expect(s.logs).toHaveLength(1);
    expect(s.logs[0]?.role).toBe('system');

    const got = sessionsRepo.get('s1');
    expect(got?.name).toBe('Workspace A');

    sessionsRepo.update('s1', { workflowState: 'running_ba', metrics: { tokens: 42 } });
    expect(sessionsRepo.get('s1')?.workflowState).toBe('running_ba');
    expect(sessionsRepo.get('s1')?.metrics.tokens).toBe(42);

    sessionsRepo.reset('s1');
    expect(sessionsRepo.get('s1')?.workflowState).toBe('idle');
    expect(sessionsRepo.get('s1')?.agentOutputs).toEqual({});

    expect(sessionsRepo.delete('s1')).toBe(true);
    expect(sessionsRepo.get('s1')).toBeUndefined();
  });
});

describe('kbRepo', () => {
  it('manages tree, insights, project summary', () => {
    expect(kbRepo.isEmpty()).toBe(true);

    kbRepo.replaceTree([
      { path: 'src/a.ts', name: 'a.ts' },
      { path: 'src/b.ts', name: 'b.ts' },
    ]);
    expect(kbRepo.listTree()).toHaveLength(2);

    kbRepo.updateTreeStatus('src/a.ts', 'done');
    const tree = kbRepo.listTree();
    expect(tree.find((t) => t.path === 'src/a.ts')?.status).toBe('done');

    kbRepo.addInsight({ id: 1, files: ['src/a.ts'], summary: 'A summary', createdAt: 100 });
    kbRepo.addInsight({ id: 2, files: ['src/b.ts'], summary: 'B summary', createdAt: 200 });
    expect(kbRepo.listInsights()).toHaveLength(2);
    expect(kbRepo.isEmpty()).toBe(false);

    kbRepo.setProjectSummary('# Wiki');
    expect(kbRepo.getProjectSummary()).toBe('# Wiki');

    const snap = kbRepo.snapshot();
    expect(snap.tree).toHaveLength(2);
    expect(snap.insights).toHaveLength(2);
    expect(snap.project_summary).toBe('# Wiki');

    kbRepo.resetAll();
    expect(kbRepo.isEmpty()).toBe(true);
    expect(kbRepo.listTree()).toHaveLength(0);
    expect(kbRepo.getProjectSummary()).toBe('');
  });
});

describe('repoRepo + scanStatusRepo + logsRepo', () => {
  it('repoRepo upserts singleton', () => {
    expect(repoRepo.get()).toBeUndefined();
    repoRepo.set({
      owner: 'octocat', repo: 'hello', branch: null, url: 'https://github.com/octocat/hello',
      githubToken: '', maxScanLimit: 5000,
    });
    expect(repoRepo.get()?.owner).toBe('octocat');
    repoRepo.setBranch('main');
    expect(repoRepo.get()?.branch).toBe('main');
    repoRepo.clear();
    expect(repoRepo.get()).toBeUndefined();
  });

  it('scanStatusRepo returns undefined until set', () => {
    expect(scanStatusRepo.get()).toBeUndefined();
    scanStatusRepo.set({ running: true, text: 'go', progress: 10, error: false });
    expect(scanStatusRepo.get()).toEqual({ running: true, text: 'go', progress: 10, error: false });
    scanStatusRepo.patch({ progress: 50 });
    expect(scanStatusRepo.get()?.progress).toBe(50);
    scanStatusRepo.clear();
    expect(scanStatusRepo.get()).toBeUndefined();
  });

  it('logsRepo orders newest first', () => {
    logsRepo.add({ id: 1, time: '00:00:01', agent: 'A', provider: 'gemini', model: 'm', inTokens: 1, outTokens: 1, latency: 0.1, cost: 0.001 });
    logsRepo.add({ id: 2, time: '00:00:02', agent: 'B', provider: 'gemini', model: 'm', inTokens: 2, outTokens: 2, latency: 0.2, cost: 0.002 });
    const logs = logsRepo.list();
    expect(logs[0]?.id).toBe(2);
    expect(logs[1]?.id).toBe(1);
    expect(logsRepo.count()).toBe(2);
    expect(logsRepo.totalCost()).toBeCloseTo(0.003);
    logsRepo.clear();
    expect(logsRepo.count()).toBe(0);
  });
});
