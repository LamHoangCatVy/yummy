/**
 * YUMMY Backend — GitHub service.
 * Wraps the GitHub REST API and raw content fetcher using global fetch.
 *
 * Mirrors backend/services/github_service.py.
 */
import { repoRepo } from '../../db/repositories/repo.repo.js';
import { HttpError } from '../../lib/errors.js';

const GITHUB_API = 'https://api.github.com';
const GITHUB_RAW = 'https://raw.githubusercontent.com';
const REQUEST_TIMEOUT_MS = 30_000;

function authHeaders(): Record<string, string> {
  const token = repoRepo.getGithubToken();
  return token ? { Authorization: `token ${token}` } : {};
}

async function timedFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call the GitHub REST API. Returns the raw Response — caller handles JSON.
 */
export async function githubFetch(path: string): Promise<Response> {
  return timedFetch(`${GITHUB_API}${path}`, { headers: authHeaders() });
}

/**
 * Fetch raw file content. Throws HttpError(404) if the file cannot be read.
 */
export async function githubRaw(
  owner: string,
  repo: string,
  branch: string,
  filePath: string,
): Promise<string> {
  const url = `${GITHUB_RAW}/${owner}/${repo}/${branch}/${filePath}`;
  const r = await timedFetch(url, { headers: authHeaders() });
  if (!r.ok) {
    throw new HttpError(
      404,
      `Cannot read file '${filePath}' from GitHub (status: ${r.status}).`,
    );
  }
  return r.text();
}

export interface RepoMetadata {
  default_branch: string;
  [key: string]: unknown;
}

/**
 * Fetch repo metadata (default_branch, description, etc.).
 * Throws Error (caller wraps into HttpError) when the API call fails.
 */
export async function getRepoInfo(
  owner: string,
  repo: string,
): Promise<RepoMetadata> {
  const resp = await githubFetch(`/repos/${owner}/${repo}`);
  if (!resp.ok) {
    let message = 'Unknown error';
    try {
      const data = (await resp.json()) as { message?: string };
      message = data.message ?? message;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(`GitHub API: ${message} (status: ${resp.status})`);
  }
  return (await resp.json()) as RepoMetadata;
}

export interface TreeEntry {
  path: string;
  type: 'blob' | 'tree' | string;
  size?: number;
  sha?: string;
  url?: string;
  mode?: string;
}

/**
 * Fetch the full recursive file tree for a repo branch.
 */
export async function getRepoTree(
  owner: string,
  repo: string,
  branch: string,
): Promise<TreeEntry[]> {
  const resp = await githubFetch(
    `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
  );
  if (!resp.ok) {
    throw new Error(`Cannot fetch file tree: ${resp.status}`);
  }
  const data = (await resp.json()) as { tree?: TreeEntry[] };
  return data.tree ?? [];
}
