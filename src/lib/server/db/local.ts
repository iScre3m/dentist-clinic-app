import '../load-env.ts';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

const databasePath = process.env.DATABASE_PATH ?? './local.db';

/**
 * File-based database used only where Node runs outside the Worker build:
 * the CLI scripts (seed, prune, staff:update) and the Vitest suites that pin
 * a temp path to `DATABASE_PATH`. The Worker itself always talks to Cloudflare
 * D1 through `hooks.server.ts` and `db/index.ts`. Importing this module inside
 * a route or service pulls the better-sqlite3 native binding into the Worker
 * bundle, where it crashes as soon as it loads.
 */
const sqlite = new Database(databasePath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
