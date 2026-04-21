import './_setup.js';
import { describe, expect, it } from 'vitest';
import { kbRepo } from '../../src/db/repositories/kb.repo.js';
import { repoRepo } from '../../src/db/repositories/repo.repo.js';
import { createApp } from '../../src/app.js';
import { setAIResponse, setDefaultAIResponse } from './_setup.js';

const app = createApp();

function seedKb() {
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
    summary: 'mock',
    createdAt: Date.now(),
  });
  kbRepo.setProjectSummary('# Mock Project');
}

async function createSession() {
  const r = await app.request('/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'SDLCTest' }),
  });
  return ((await r.json()) as { id: string }).id;
}

describe('sdlc workflow integration', () => {
  it('rejects approve-ba before /start', async () => {
    const sid = await createSession();
    const res = await app.request('/sdlc/approve-ba', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sid }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown session on state', async () => {
    const res = await app.request('/sdlc/nope/state');
    expect(res.status).toBe(404);
  });

  it('runs full BA → SA → Dev Lead → DEV/SEC/QA/SRE pipeline', async () => {
    seedKb();
    const sid = await createSession();

    setAIResponse('BA', 'BRD content here');
    setAIResponse('SA', 'Architecture here');
    setAIResponse(
      'PM',
      '```json\n{"epics":[{"epic":"E1","stories":["S1","S2"]}]}\n```',
    );
    setAIResponse('DEV_LEAD', 'Implementation plan');
    setAIResponse('DEV', 'Code commits');
    setAIResponse('SECURITY', 'No CVEs');
    setAIResponse('QA', 'All tests pass');
    setAIResponse('SRE', 'Deployed to prod');
    setDefaultAIResponse('default');

    // 1. /sdlc/start → BA
    const start = await app.request('/sdlc/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sid, requirement: 'Build feature X' }),
    });
    expect(start.status).toBe(200);
    const startBody = (await start.json()) as { status: string; ba_output: string };
    expect(startBody.status).toBe('waiting_ba_approval');
    expect(startBody.ba_output).toBe('BRD content here');

    // 2. approve-ba → SA + PM (parallel) → backlog
    const ba = await app.request('/sdlc/approve-ba', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sid }),
    });
    expect(ba.status).toBe(200);
    const baBody = (await ba.json()) as {
      status: string;
      sa_output: string;
      jira_backlog: unknown[];
    };
    expect(baBody.status).toBe('waiting_sa_approval');
    expect(baBody.sa_output).toBe('Architecture here');
    expect(baBody.jira_backlog).toEqual([
      { epic: 'E1', stories: ['S1', 'S2'] },
    ]);

    // 3. approve-sa → Dev Lead
    const sa = await app.request('/sdlc/approve-sa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sid }),
    });
    expect(sa.status).toBe(200);
    const saBody = (await sa.json()) as { status: string; dev_lead_output: string };
    expect(saBody.status).toBe('waiting_dev_lead_approval');
    expect(saBody.dev_lead_output).toBe('Implementation plan');

    // 4. approve-dev-lead → DEV/SEC/QA/SRE
    const dl = await app.request('/sdlc/approve-dev-lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sid }),
    });
    expect(dl.status).toBe(200);
    const dlBody = (await dl.json()) as {
      status: string;
      dev_output: string;
      security_output: string;
      qa_output: string;
      sre_output: string;
    };
    expect(dlBody.status).toBe('done');
    expect(dlBody.dev_output).toBe('Code commits');
    expect(dlBody.security_output).toBe('No CVEs');
    expect(dlBody.qa_output).toBe('All tests pass');
    expect(dlBody.sre_output).toBe('Deployed to prod');

    // Final state reflects everything
    const state = await app.request(`/sdlc/${sid}/state`);
    const stateBody = (await state.json()) as {
      workflow_state: string;
      agent_outputs: Record<string, unknown>;
      jira_backlog: unknown[];
    };
    expect(stateBody.workflow_state).toBe('done');
    expect(stateBody.agent_outputs.requirement).toBe('Build feature X');
    expect(stateBody.agent_outputs.ba).toBe('BRD content here');
    expect(stateBody.agent_outputs.sa).toBe('Architecture here');
    expect(stateBody.agent_outputs.dev_lead).toBe('Implementation plan');
    expect(stateBody.agent_outputs.dev).toBe('Code commits');
    expect(stateBody.jira_backlog).toHaveLength(1);
  });

  it('approve-ba accepts edited_content override', async () => {
    seedKb();
    const sid = await createSession();
    setAIResponse('BA', 'original BA');
    setAIResponse('SA', 'sa');
    setAIResponse('PM', '[]');

    await app.request('/sdlc/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sid, requirement: 'X' }),
    });

    await app.request('/sdlc/approve-ba', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sid, edited_content: 'EDITED BRD' }),
    });

    const state = await app.request(`/sdlc/${sid}/state`);
    const body = (await state.json()) as {
      agent_outputs: Record<string, unknown>;
    };
    expect(body.agent_outputs.ba).toBe('EDITED BRD');
  });

  it('PM JSON parse failure falls back to []', async () => {
    seedKb();
    const sid = await createSession();
    setAIResponse('BA', 'ba');
    setAIResponse('SA', 'sa');
    setAIResponse('PM', 'not valid json at all');

    await app.request('/sdlc/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sid, requirement: 'X' }),
    });
    const ba = await app.request('/sdlc/approve-ba', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sid }),
    });
    const body = (await ba.json()) as { jira_backlog: unknown[] };
    expect(body.jira_backlog).toEqual([]);
  });
});
