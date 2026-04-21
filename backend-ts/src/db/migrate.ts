/**
 * Apply pending Drizzle migrations from src/db/migrations.
 * Run via `pnpm db:migrate`.
 */
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolve } from 'node:path';

import { db, rawDb } from './client.js';

const migrationsFolder = resolve(import.meta.dirname, 'migrations');

console.log(`[migrate] Applying migrations from ${migrationsFolder}`);
migrate(db, { migrationsFolder });
console.log('[migrate] ✅ Done');

rawDb.close();
