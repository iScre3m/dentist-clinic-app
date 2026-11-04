/**
 * Remote Cloudflare D1 access for CLI scripts.
 *
 * Wraps the D1 HTTP query API in a minimal object that satisfies Drizzle's D1
 * driver, so the same Drizzle schema and seed logic used for the local file
 * database can run against the *remote* database from Node scripts.
 * Nothing here is used by the app itself; the Worker keeps its D1 binding.
 *
 * Requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in `.env` (account
 * token with D1 edit permission), like `wrangler d1 migrations apply --remote`.
 *
 * Examples at the end of `scripts/seed-remote.ts` and `scripts/staff-update.ts`.
 */

import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import { unstable_readConfig } from 'wrangler';
import * as schema from '../src/lib/server/db/schema.js';

/** Shape of one statement result, as returned by the D1 HTTP API. */
interface D1QueryResult {
	results: Record<string, unknown>[];
	success: boolean;
	meta?: Record<string, unknown>;
}

interface D1Config {
	token: string;
	accountId: string;
	databaseId: string;
}

/** Read the remote-D1 configuration from `.env` and wrangler.jsonc, or fail with a clear message. */
export function loadRemoteD1Config(configPath = 'wrangler.jsonc'): D1Config {
	const token = process.env.CLOUDFLARE_API_TOKEN;
	const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
	if (!token || !accountId) {
		throw new Error(
			'Falta CLOUDFLARE_ACCOUNT_ID y/o CLOUDFLARE_API_TOKEN en .env (token con permiso de edición en D1).'
		);
	}
	const config = unstable_readConfig({ config: configPath });
	const database = config.d1_databases?.[0];
	if (!database?.database_id) {
		throw new Error('wrangler.jsonc no define una base de datos D1 (d1_databases).');
	}
	return { token, accountId, databaseId: database.database_id };
}

/**
 * Implements just enough of D1's binding API for Drizzle:
 * - prepare(sql).bind(...params) → { run, all, raw } promise-returning executors
 * - batch(statements) falls back to sequential execution (scripts never rely
 *   on multi-statement atomic batches)
 */
export class RemoteD1Client {
	constructor(private config: D1Config) {}

	private async query(sql: string, params: unknown[]): Promise<D1QueryResult> {
		const url =
			`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(this.config.accountId)}` +
			`/d1/database/${encodeURIComponent(this.config.databaseId)}/query`;
		const response = await fetch(url, {
			method: 'POST',
			headers: { Authorization: `Bearer ${this.config.token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ sql, params })
		});
		if (!response.ok) {
			const text = await response.text();
			throw new Error(`D1 HTTP ${response.status}: ${text.slice(0, 300)}`);
		}
		const body = (await response.json()) as {
			success: boolean;
			errors?: { code: number; message: string }[];
			result?: D1QueryResult[];
		};
		if (!body.success || !body.result?.length) {
			const detail = (body.errors ?? []).map((e) => e.message).join('; ');
			throw new Error(detail ? `D1: ${detail}` : 'D1: respuesta vacía');
		}
		return body.result[0];
	}

	/** Raw SQL helper for preflight checks (returns plain rows as objects). */
	async execute(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
		return (await this.query(sql, params)).results;
	}

	prepare(sql: string) {
		return {
			bind: (...params: unknown[]) => ({
				run: async (): Promise<D1QueryResult> => this.query(sql, params),
				all: async (): Promise<D1QueryResult> => this.query(sql, params),
				/** D1 `raw()` semantics: rows as arrays in query-column order. */
				raw: async (): Promise<unknown[][]> => {
					const { results } = await this.query(sql, params);
					return results.map((row) => Object.values(row));
				}
			})
		};
	}

	async batch(statements: { bind: () => { run: () => Promise<D1QueryResult> } }[]): Promise<D1QueryResult[]> {
		const results: D1QueryResult[] = [];
		for (const statement of statements) {
			results.push(await statement.bind().run());
		}
		return results;
	}
}

/**
 * Drizzle client over the remote D1 database, using the same schema as the
 * local file database and the Worker.
 */
export function createRemoteD1Db(configPath = 'wrangler.jsonc'): DrizzleD1Database<typeof schema> {
	const config = loadRemoteD1Config(configPath);
	const client = new RemoteD1Client(config);
	return drizzle(client as never, { schema });
}
