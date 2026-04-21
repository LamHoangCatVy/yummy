/**
 * Knowledge base repository — combines tree + insights + project_summary.
 * Matches Python's DB["knowledge_base"] = {tree, insights, project_summary}.
 */
import { asc, eq } from 'drizzle-orm';
import { db } from '../client.js';
import { kbInsights, kbMeta, kbTree, type KbInsightRow, type KbTreeRow } from '../schema.js';

export type TreeEntry = KbTreeRow;
export type Insight = KbInsightRow;

export const kbRepo = {
  // ─── Tree ─────────────────────────────────────────────
  listTree(): TreeEntry[] {
    return db.select().from(kbTree).all();
  },

  replaceTree(entries: Array<Omit<TreeEntry, 'status'> & { status?: string }>): void {
    db.transaction((tx) => {
      tx.delete(kbTree).run();
      if (entries.length === 0) return;
      tx.insert(kbTree)
        .values(entries.map((e) => ({ path: e.path, name: e.name, status: e.status ?? 'pending' })))
        .run();
    });
  },

  updateTreeStatus(path: string, status: string): void {
    db.update(kbTree).set({ status }).where(eq(kbTree.path, path)).run();
  },

  clearTree(): void {
    db.delete(kbTree).run();
  },

  // ─── Insights ─────────────────────────────────────────
  listInsights(): Insight[] {
    return db.select().from(kbInsights).orderBy(asc(kbInsights.createdAt)).all();
  },

  addInsight(insight: Insight): void {
    db.insert(kbInsights).values(insight).run();
  },

  clearInsights(): void {
    db.delete(kbInsights).run();
  },

  // ─── Project summary (singleton) ──────────────────────
  getProjectSummary(): string {
    const row = db.select().from(kbMeta).where(eq(kbMeta.id, 1)).get();
    return row?.projectSummary ?? '';
  },

  setProjectSummary(summary: string): void {
    const existing = db.select().from(kbMeta).where(eq(kbMeta.id, 1)).get();
    if (existing) {
      db.update(kbMeta).set({ projectSummary: summary }).where(eq(kbMeta.id, 1)).run();
    } else {
      db.insert(kbMeta).values({ id: 1, projectSummary: summary }).run();
    }
  },

  /** Reset everything — used by DELETE /kb and at scan start. */
  resetAll(): void {
    db.transaction((tx) => {
      tx.delete(kbTree).run();
      tx.delete(kbInsights).run();
      tx.delete(kbMeta).run();
    });
  },

  /** Whole-KB snapshot for /kb GET. */
  snapshot(): { tree: TreeEntry[]; insights: Insight[]; project_summary: string } {
    return {
      tree: this.listTree(),
      insights: this.listInsights(),
      project_summary: this.getProjectSummary(),
    };
  },

  isEmpty(): boolean {
    const r = db.select({ id: kbInsights.id }).from(kbInsights).limit(1).get();
    return r === undefined;
  },
};
