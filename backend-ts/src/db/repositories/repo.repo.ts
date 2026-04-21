/**
 * Repo info — singleton row id=1. Returns undefined if not configured.
 */
import { eq } from 'drizzle-orm';
import { db } from '../client.js';
import { repoInfo, type RepoInfoRow } from '../schema.js';

export type RepoInfo = RepoInfoRow;

export const repoRepo = {
  get(): RepoInfo | undefined {
    return db.select().from(repoInfo).where(eq(repoInfo.id, 1)).get();
  },

  set(info: Omit<RepoInfo, 'id'>): RepoInfo {
    const existing = this.get();
    if (existing) {
      db.update(repoInfo).set(info).where(eq(repoInfo.id, 1)).run();
    } else {
      db.insert(repoInfo).values({ id: 1, ...info }).run();
    }
    return { id: 1, ...info };
  },

  setBranch(branch: string): void {
    db.update(repoInfo).set({ branch }).where(eq(repoInfo.id, 1)).run();
  },

  /** Token getter — returns "" when no repo configured. */
  getGithubToken(): string {
    return this.get()?.githubToken ?? '';
  },

  /** Update only the github token; no-op when no repo row exists. */
  setGithubToken(token: string): void {
    if (!this.get()) return;
    db.update(repoInfo).set({ githubToken: token }).where(eq(repoInfo.id, 1)).run();
  },

  clear(): void {
    db.delete(repoInfo).run();
  },
};
