import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { TEST_DATABASE_PATH } from './support/env.ts';

/**
 * Runs once before the tests.
 *
 * The Playwright server uses its own SQLite file, so that file must be migrated
 * and seeded before any spec can log in. Migrations and seeding are idempotent,
 * and every table is emptied first so a run never inherits appointments,
 * reminders or sessions from a previous one. The file itself is not deleted
 * because the web server may already have it open (Windows keeps a lock).
 */
export default function globalSetup(): void {
	const databasePath = resolve(TEST_DATABASE_PATH);

	const sqlite = new Database(databasePath);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = OFF');

	migrate(drizzle(sqlite), { migrationsFolder: resolve('drizzle') });
	clearAllTables(sqlite);

	sqlite.close();

	execSync('pnpm db:seed', {
		stdio: 'inherit',
		env: { ...process.env, DATABASE_PATH: databasePath }
	});
}

function clearAllTables(sqlite: InstanceType<typeof Database>): void {
	const tables = sqlite
		.prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'")
		.all() as { name: string }[];

	for (const { name } of tables) {
		// Keep Drizzle's migration bookkeeping so migrations stay incremental.
		if (name.startsWith('__drizzle')) continue;
		sqlite.prepare(`delete from "${name}"`).run();
	}
}
