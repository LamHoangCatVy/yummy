/**
 * Request logs — newest-first ordering (matches Python `insert(0, ...)`).
 */
import { desc } from 'drizzle-orm';
import { db } from '../client.js';
import { requestLogs, type RequestLogInsert, type RequestLogRow } from '../schema.js';

export type RequestLog = RequestLogRow;

export const logsRepo = {
  list(): RequestLog[] {
    return db.select().from(requestLogs).orderBy(desc(requestLogs.id)).all();
  },

  add(log: RequestLogInsert): void {
    db.insert(requestLogs).values(log).run();
  },

  clear(): void {
    db.delete(requestLogs).run();
  },

  count(): number {
    const rows = db.select({ id: requestLogs.id }).from(requestLogs).all();
    return rows.length;
  },

  totalCost(): number {
    const rows = db.select({ cost: requestLogs.cost }).from(requestLogs).all();
    return rows.reduce((sum, r) => sum + (r.cost ?? 0), 0);
  },
};
