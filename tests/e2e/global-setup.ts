import { execSync } from 'node:child_process';
import { drizzle } from 'drizzle-orm/d1';
import { getPlatformProxy } from 'wrangler';
import * as schema from '../../src/lib/server/db/schema.ts';
import { seedDatabase } from '../../src/lib/server/db/seed.ts';
import { STAFF_NAME, STAFF_EMAIL, STAFF_PASSWORD } from './support/env.ts';

/**
 * Runs once before the tests.
 *
 * The Playwright web server (`vite dev` + the Cloudflare Vite plugin) runs the
 * app in workerd and talks to the local D1 database that wrangler persists in
 * `.wrangler/state/v3` — the same one `getPlatformProxy` opens here. So the
 * setup migrates that local database, empties it and seeds it. The remote
 * production database is never touched; local state is disposable like the
 * old test.db file was.
 *
 * Do not run `pnpm dev` against the same state while the suite is running:
 * both processes open the same SQLite files.
 */
export default async function globalSetup(): Promise<void> {
	execSync('pnpm exec wrangler d1 migrations apply DB --local', { stdio: 'inherit' });

	const proxy = await getPlatformProxy<Env>();
	try {
		const db = drizzle(proxy.env.DB, { schema });
		await clearAllTables(proxy.env.DB);
		await seedDatabase(db, {
			staffName: STAFF_NAME,
			staffEmail: STAFF_EMAIL,
			staffPassword: STAFF_PASSWORD
		});
		console.log('✅ Local D1 migrada, vaciada y sembrada para e2e.');
	} finally {
		await proxy.dispose();
	}
}

/**
 * Empty every table so a run never inherits appointments, reminders or
 * sessions from a previous one. Drizzle's and D1's own bookkeeping tables stay.
 *
 * D1 keeps foreign keys enabled and offers no way to turn them off, so the
 * delete order has to respect the schema's FK graph (user → account/session,
 * patients → appointments/…). Instead of hardcoding an order, pass over every
 * table and skip the ones still blocked by dependencies; a second pass clears
 * them. Full-table deletes also never violate a table's own self-reference.
 */
async function clearAllTables(d1: Env['DB']): Promise<void> {
	const tables = (
		await d1
			.prepare(
				"select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like 'd1_%' and name not like '_cf_%'"
			)
			.all<{ name: string }>()
	).results.map((row) => row.name);

	let pending = tables;
	for (let pass = 0; pending.length > 0; pass++) {
		const blocked: string[] = [];
		for (const name of pending) {
			try {
				await d1.prepare(`delete from "${name}"`).run();
			} catch {
				blocked.push(name);
			}
		}
		if (blocked.length === pending.length) {
			throw new Error(`No se pudieron vaciar todas las tablas: ${blocked.join(', ')}`);
		}
		pending = blocked;
	}
}
