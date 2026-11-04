import * as schema from './schema';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

/**
 * D1-backed database access for the Worker.
 *
 * `drizzle-orm/d1` instances are stateless wrappers around the binding, so one
 * isolate-wide handle is safe even with concurrent requests. `hooks.server.ts`
 * installs the handle before any route runs; services keep importing the `db`
 * proxy, which forward every call to the installed handle.
 *
 * Never import `better-sqlite3` from here: its native binding cannot load
 * inside a Cloudflare Worker (see `db/local.ts`, Node-only).
 */

export type AppDatabase = DrizzleD1Database<typeof schema>;

let database: object | null = null;

/**
 * Install the isolate-wide database handle. Called from `hooks.server.ts` per
 * request (cheap and idempotent). Tests can install a better-sqlite3 handle
 * from `db/local.ts`, which speaks the same Drizzle query API.
 */
export function installDb(handle: object): void {
	database = handle;
}

export const db = new Proxy({} as AppDatabase, {
	get(_target, property) {
		if (database === null) {
			throw new Error(
				'La base de datos D1 no está inicializada. installDb() debe ejecutarse en hooks.server.ts antes de atender una request.'
			);
		}
		const value = Reflect.get(database, property);
		return typeof value === 'function' ? value.bind(database) : value;
	}
});
