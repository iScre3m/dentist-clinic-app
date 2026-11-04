/*
 * Seed the REMOTE Cloudflare D1 database (wrangler.jsonc) with the staff
 * account and the same catalog → synthetic data the local seed uses.
 *
 * You only edit these in `.env`, then run `pnpm db:seed:remote`:
 *
 *   SEED_STAFF_NAME=Dra. Laura
 *   SEED_STAFF_EMAIL=staff@example.com
 *   SEED_STAFF_PASSWORD=change-me-too
 *
 * Examples:
 *   pnpm db:seed:remote            # seeds the remote database (asks to confirm)
 *   pnpm db:seed:remote -- --yes   # same, without the confirmation prompt
 *
 * Notes:
 * - Apply migrations first if the schema is missing:
 *     pnpm exec wrangler d1 migrations apply DB --remote
 * - It is idempotent: it never overwrites an existing staff password
 *   (that is what `pnpm staff:update -- --password ... --remote` is for).
 * - Pairs with the local equivalent:  pnpm db:seed
 */

import '../src/lib/server/load-env.ts';
import { drizzle } from 'drizzle-orm/d1';
import { unstable_readConfig } from 'wrangler';
import { loadRemoteD1Config, RemoteD1Client } from './d1-remote.ts';
import * as schema from '../src/lib/server/db/schema.ts';
import { seedDatabase } from '../src/lib/server/db/seed.ts';

const STAFF_NAME = process.env.SEED_STAFF_NAME ?? 'Dra. Laura';
const STAFF_EMAIL = process.env.SEED_STAFF_EMAIL ?? 'staff@example.com';
const STAFF_PASSWORD = process.env.SEED_STAFF_PASSWORD;
if (!STAFF_PASSWORD) {
	console.error('Falta SEED_STAFF_PASSWORD en .env.');
	process.exit(1);
}

const config = unstable_readConfig({ config: 'wrangler.jsonc' });
const databaseName = config.d1_databases?.[0]?.database_name ?? 'DB';
const client = new RemoteD1Client(loadRemoteD1Config());

// Preflight: migrations applied?
const tables = await client.execute(
	"SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('user', 'account', 'patients')"
);
if (tables.length < 3) {
	console.error(
		'Faltan tablas en la base remota. Aplicá las migraciones primero:\n' +
			'  pnpm exec wrangler d1 migrations apply DB --remote'
	);
	process.exit(1);
}

const syntheticRows = await client.execute('SELECT COUNT(*) AS n FROM patients');
const patientCount = Number(
	(syntheticRows[0] as { n?: number } | undefined)?.n ?? 0
);

if (patientCount > 0) {
	console.log(
		`La base ${databaseName} ya tiene ${patientCount} paciente(s); el seed rellena solo lo que falta.`
	);
} else if (!process.argv.includes('--yes')) {
	const answer = await confirm(
		`Esto escribe datos de PRUEBA en la base REMOTA (${databaseName}). ¿Continuar? (s/N) `
	);
	if (answer !== 's') {
		console.log('Cancelado.');
		process.exit(0);
	}
}

const db = drizzle(client as never, { schema });
const result = await seedDatabase(db, {
	staffName: STAFF_NAME,
	staffEmail: STAFF_EMAIL,
	staffPassword: STAFF_PASSWORD
});

console.log(`Listo (remota). Personal: ${result.staffEmail}`);

/** Simple stdin confirm. */
function confirm(question: string): Promise<string> {
	console.error(question);
	process.stdin.setEncoding('utf8');
	return new Promise((resolve) => {
		process.stdin.resume();
		process.stdin.once('data', (chunk: string) => {
			process.stdin.pause();
			resolve(chunk.trim().toLowerCase());
		});
	});
}
