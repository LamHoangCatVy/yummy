import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.DATABASE_URL = ':memory:';

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolve } from 'node:path';

import { db } from '../../src/db/client.js';
import { repoRepo } from '../../src/db/repositories/repo.repo.js';
import {
  getRepoInfo,
  getRepoTree,
  githubFetch,
  githubRaw,
} from '../../src/services/github/github.service.js';

beforeAll(() => {
  migrate(db, { migrationsFolder: resolve(__dirname, '../../src/db/migrations') });
});

beforeEach(() => {
  repoRepo.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(((
    input: string | URL | Request,
    init?: RequestInit,
  ) => impl(String(input), init)) as typeof fetch);
}

describe('githubFetch', () => {
  it('hits the API base URL with no auth header when no token configured', async () => {
    let seenUrl = '';
    let seenAuth: string | undefined;
    mockFetch(async (url, init) => {
      seenUrl = url;
      seenAuth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      return new Response('{}', { status: 200 });
    });

    await githubFetch('/repos/foo/bar');
    expect(seenUrl).toBe('https://api.github.com/repos/foo/bar');
    expect(seenAuth).toBeUndefined();
  });

  it('attaches token auth header when repo has github_token', async () => {
    repoRepo.set({
      owner: 'me',
      repo: 'r',
      branch: 'main',
      url: 'https://github.com/me/r',
      githubToken: 'ghp_secret',
      maxScanLimit: 1000,
    });

    let seenAuth: string | undefined;
    mockFetch(async (_url, init) => {
      seenAuth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      return new Response('{}', { status: 200 });
    });

    await githubFetch('/repos/me/r');
    expect(seenAuth).toBe('token ghp_secret');
  });
});

describe('githubRaw', () => {
  it('returns text body on 200', async () => {
    mockFetch(async () => new Response('hello-source', { status: 200 }));
    const text = await githubRaw('o', 'r', 'main', 'src/x.ts');
    expect(text).toBe('hello-source');
  });

  it('throws HttpError(404) on non-200', async () => {
    mockFetch(async () => new Response('nope', { status: 500 }));
    await expect(githubRaw('o', 'r', 'main', 'src/x.ts')).rejects.toMatchObject({
      status: 404,
      detail: expect.stringContaining("'src/x.ts'"),
    });
  });
});

describe('getRepoInfo', () => {
  it('returns parsed JSON on success', async () => {
    mockFetch(async () =>
      new Response(JSON.stringify({ default_branch: 'main', name: 'r' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const info = await getRepoInfo('o', 'r');
    expect(info.default_branch).toBe('main');
  });

  it('throws Error containing the API message on failure', async () => {
    mockFetch(async () =>
      new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 }),
    );
    await expect(getRepoInfo('o', 'missing')).rejects.toThrow(/Not Found/);
  });
});

describe('getRepoTree', () => {
  it('returns tree array on success', async () => {
    mockFetch(async () =>
      new Response(
        JSON.stringify({
          tree: [
            { path: 'src/a.ts', type: 'blob', size: 10 },
            { path: 'src', type: 'tree' },
          ],
        }),
        { status: 200 },
      ),
    );
    const tree = await getRepoTree('o', 'r', 'main');
    expect(tree).toHaveLength(2);
    expect(tree[0]?.path).toBe('src/a.ts');
  });
});
