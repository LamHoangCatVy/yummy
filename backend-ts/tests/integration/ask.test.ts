import './_setup.js';
import { describe, expect, it } from 'vitest';
import { kbRepo } from '../../src/db/repositories/kb.repo.js';
import { repoRepo } from '../../src/db/repositories/repo.repo.js';
import { createApp } from '../../src/app.js';
import { setAIResponse } from './_setup.js';

const app = createApp();

async function createSession() {
  const r = await app.request('/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'AskTest' }),
  });
  return ((await r.json()) as { id: string }).id;
}

function seedKb() {
  // Repo info is needed for buildRagPrompt? Check guards — only requireKnowledgeBase.
  // We seed a small KB directly to bypass scan.
  repoRepo.set({
    url: 'https://github.com/mock/mock',
    owner: 'mock',
    repo: 'mock',
    branch: 'main',
    githubToken: '',
    maxScanLimit: 100,
  });
  kbRepo.replaceTree([{ path: 'README.md', name: 'README.md', status: 'done' }]);
  kbRepo.addInsight({
    id: 1,
    files: ['README.md'],
    summary: 'project does X',
    createdAt: Date.now(),
  });
  kbRepo.setProjectSummary('# Project Mock\nA mock project.');
}

describe('ask integration', () => {
  it('POST /ask/sync returns 404 for unknown session', async () => {
    seedKb();
    const res = await app.request('/ask/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: 'nope', question: 'hi' }),
    });
    expect(res.status).toBe(404);
  });

  it('POST /ask/sync returns 400 when KB is empty', async () => {
    const sid = await createSession();
    const res = await app.request('/ask/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sid, question: 'hi' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /ask/sync returns answer + appends to chat history', async () => {
    seedKb();
    const sid = await createSession();
    setAIResponse('EXPERT', 'The answer is 42.');

    const res = await app.request('/ask/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        session_id: sid,
        question: 'What is the meaning?',
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      question: string;
      answer: string;
      session_id: string;
      trace: unknown;
    };
    expect(body.answer).toBe('The answer is 42.');
    expect(body.question).toBe('What is the meaning?');
    expect(body.session_id).toBe(sid);
    expect(body.trace).toBeDefined();

    // History has 2 new entries appended
    const histRes = await app.request(`/sessions/${sid}`);
    const hist = (await histRes.json()) as {
      chat_history: Array<{ role: string; text: string }>;
    };
    expect(hist.chat_history).toHaveLength(2);
    expect(hist.chat_history[0]?.role).toBe('user');
    expect(hist.chat_history[1]?.role).toBe('assistant');
    expect(hist.chat_history[1]?.text).toBe('The answer is 42.');
  });
});
