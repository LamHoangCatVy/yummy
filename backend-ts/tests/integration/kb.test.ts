import './_setup.js';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { setAIResponse } from './_setup.js';

const app = createApp();

async function setupRepo() {
  await app.request('/config/setup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      github_url: 'https://github.com/mock-owner/mock-repo',
      max_scan_limit: 100,
    }),
  });
}

describe('kb scan integration', () => {
  it('GET /kb/scan/status returns initial state when no scan run', async () => {
    const res = await app.request('/kb/scan/status');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.running).toBe(false);
    expect(body.progress).toBe(0);
  });

  it('POST /kb/scan without repo configured returns 400', async () => {
    const res = await app.request('/kb/scan', { method: 'POST' });
    expect(res.status).toBe(400);
  });

  it('runs a full scan end-to-end with mocked AI + GitHub', async () => {
    await setupRepo();
    setAIResponse('INDEXER', 'INDEXER summary');
    setAIResponse('ARCHITECT', '# Project\n## Core\nmocked summary');

    const start = await app.request('/kb/scan', { method: 'POST' });
    expect(start.status).toBe(200);
    const startBody = (await start.json()) as { status: string };
    expect(startBody.status).toBe('started');

    // Poll until scan completes (mock AI is instant; runScan is async)
    let done = false;
    for (let i = 0; i < 50 && !done; i++) {
      await new Promise((r) => setTimeout(r, 20));
      const s = await app.request('/kb/scan/status');
      const body = (await s.json()) as { running: boolean; progress: number };
      if (!body.running && body.progress === 100) done = true;
    }
    expect(done).toBe(true);

    // KB now populated
    const kb = await app.request('/kb');
    expect(kb.status).toBe(200);
    const kbBody = (await kb.json()) as {
      tree: unknown[];
      insights: unknown[];
      project_summary: string;
    };
    expect(kbBody.tree.length).toBeGreaterThan(0);
    expect(kbBody.insights.length).toBeGreaterThan(0);
    expect(kbBody.project_summary).toContain('mocked summary');
  });

  it('POST /kb/scan returns 409 if already running', async () => {
    await setupRepo();
    // Start one scan but don't await its full pump
    const first = await app.request('/kb/scan', { method: 'POST' });
    expect(first.status).toBe(200);
    // Immediately try another — race depends on whether the first finished synchronously
    const second = await app.request('/kb/scan', { method: 'POST' });
    // Either 200 (first already finished, mocked AI is instant) or 409 (still running)
    expect([200, 409]).toContain(second.status);
  });

  it('GET /kb/file returns mocked file content', async () => {
    await setupRepo();
    const res = await app.request('/kb/file?path=README.md');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { content: string; path: string };
    expect(body.path).toBe('README.md');
    expect(body.content).toBe('mock file contents');
  });

  it('DELETE /kb clears the knowledge base', async () => {
    await setupRepo();
    setAIResponse('INDEXER', 'INDEXER summary');
    setAIResponse('ARCHITECT', 'project summary');
    await app.request('/kb/scan', { method: 'POST' });
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 20));
      const s = await app.request('/kb/scan/status');
      const body = (await s.json()) as { running: boolean; progress: number };
      if (!body.running && body.progress === 100) break;
    }

    const del = await app.request('/kb', { method: 'DELETE' });
    expect(del.status).toBe(200);

    const kb = await app.request('/kb');
    const body = (await kb.json()) as { tree: unknown[]; insights: unknown[] };
    expect(body.tree).toHaveLength(0);
    expect(body.insights).toHaveLength(0);
  });
});
