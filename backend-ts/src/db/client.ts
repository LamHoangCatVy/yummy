/**
 * SQLite client (better-sqlite3) + Drizzle wrapper.
 * Single shared instance; pragmas tuned for write-heavy + concurrent reads.
 */
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { env } from '../config/env.js';
import * as schema from './schema.js';

function resolveDbPath(): string {
  const url = env.DATABASE_URL;
  // Allow `:memory:` for tests
  if (url === ':memory:') return url;
  const abs = resolve(url);
  mkdirSync(dirname(abs), { recursive: true });
  return abs;
}

const sqlite = new Database(resolveDbPath());
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('foreign_keys = ON');

export const db: BetterSQLite3Database<typeof schema> = drizzle(sqlite, { schema });
export const rawDb: Database.Database = sqlite;
export { schema };
