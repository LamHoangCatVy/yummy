/**
 * Scan status — singleton row id=1.
 * Returns undefined when no scan has been initialized (Python's `None`).
 */
import { eq } from 'drizzle-orm';
import { db } from '../client.js';
import { scanStatus, type ScanStatusRow } from '../schema.js';

export interface ScanStatus {
  running: boolean;
  text: string;
  progress: number;
  error: boolean;
}

const ROW_ID = 1;

export const scanStatusRepo = {
  get(): ScanStatus | undefined {
    const row = db.select().from(scanStatus).where(eq(scanStatus.id, ROW_ID)).get();
    if (!row || !row.initialized) return undefined;
    return {
      running: row.running,
      text: row.text,
      progress: row.progress,
      error: row.error,
    };
  },

  set(s: ScanStatus): void {
    const row: ScanStatusRow = {
      id: ROW_ID,
      running: s.running,
      text: s.text,
      progress: s.progress,
      error: s.error,
      initialized: true,
    };
    const existing = db.select().from(scanStatus).where(eq(scanStatus.id, ROW_ID)).get();
    if (existing) {
      db.update(scanStatus).set(row).where(eq(scanStatus.id, ROW_ID)).run();
    } else {
      db.insert(scanStatus).values(row).run();
    }
  },

  patch(patch: Partial<ScanStatus>): void {
    const cur = this.get();
    this.set({
      running: patch.running ?? cur?.running ?? false,
      text: patch.text ?? cur?.text ?? '',
      progress: patch.progress ?? cur?.progress ?? 0,
      error: patch.error ?? cur?.error ?? false,
    });
  },

  clear(): void {
    db.delete(scanStatus).where(eq(scanStatus.id, ROW_ID)).run();
  },
};
