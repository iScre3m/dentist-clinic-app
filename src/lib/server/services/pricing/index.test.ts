import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * DB-backed unit tests for the pricing service.
 *
 * `db/index.ts` resolves the database path once at import time, so a temp file
 * is pinned to `DATABASE_PATH` before importing any server module. Migrations
 * are applied first with a separate connection (same pattern as
 * `tests/e2e/global-setup.ts`), then the singleton picks up the migrated file.
 */

const tempDir = mkdtempSync(join(tmpdir(), 'dentist-pricing-'));
const databasePath = join(tempDir, 'test.db');
process.env.DATABASE_PATH = databasePath;

const migrationDb = new Database(databasePath);
migrationDb.pragma('journal_mode = WAL');
migrate(drizzle(migrationDb), { migrationsFolder: resolve('drizzle') });
migrationDb.close();

const { db } = await import('#lib/server/db/index.ts');
const { user, servicePrices } = await import('#lib/server/db/schema.ts');
const {
	createServicePrice,
	hasAllPrices,
	listActiveServicePrices,
	listServicePrices,
	setActive,
	getPriceForService,
	updatePrice
} = await import('#lib/server/services/pricing/index.ts');

const STAFF_1 = { id: 'staff-1', name: 'Dra. Laura', email: 'laura@test.local' };
const STAFF_2 = { id: 'staff-2', name: 'Asistente Ana', email: 'ana@test.local' };

/** Windows clock resolution can round timestamps to the same value; wait once. */
function tick(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 30));
}

let consultaId: string;
let limpiezaId: string;

beforeAll(async () => {
	await db.insert(user).values([STAFF_1, STAFF_2]);
});

afterAll(() => {
	try {
		rmSync(tempDir);
	} catch {
		// The singleton connection keeps the file open on Windows; OS temp cleans up.
	}
});

describe('createServicePrice', () => {
	it('adds a permanent catalog row, active, with who recorded it', async () => {
		const result = await createServicePrice(
			{ serviceType: 'Consulta', name: ' Consulta ', price: 15000 },
			STAFF_1.id
		);
		expect(result).toEqual({ ok: true, id: expect.any(String) });
		consultaId = (result as { ok: true; id: string }).id;

		const [row] = await db.select().from(servicePrices).where(eqId(consultaId));
		expect(row?.serviceType).toBe('consulta');
		expect(row?.name).toBe('Consulta');
		expect(row?.price).toBe(15000);
		expect(row?.isActive).toBe(true);
		expect(row?.updatedBy).toBe(STAFF_1.id);
		expect(row?.updatedAt.getTime()).toBe(row?.createdAt.getTime());
	});

	it('rejects a duplicated service type instead of overwriting a price', async () => {
		const result = await createServicePrice(
			{ serviceType: 'consulta', name: 'Otra consulta', price: 999 },
			STAFF_1.id
		);
		expect(result).toEqual({ ok: false, reason: 'duplicate-type' });
	});

	it('rejects invalid input without touching the catalog', async () => {
		expect(
			await createServicePrice({ serviceType: 'x', name: 'Nombre', price: 100 }, STAFF_1.id)
		).toEqual({ ok: false, reason: 'invalid-input' });
		expect(
			await createServicePrice({ serviceType: 'valida', name: 'Nombre', price: -1 }, STAFF_1.id)
		).toEqual({ ok: false, reason: 'invalid-input' });

		const rows = await db.select().from(servicePrices);
		expect(rows).toHaveLength(1);
	});

	it('records a second catalog entry used for deactivation tests', async () => {
		const result = await createServicePrice(
			{ serviceType: 'limpieza', name: 'Limpieza', price: 20000 },
			STAFF_1.id
		);
		expect(result.ok).toBe(true);
		limpiezaId = (result as { ok: true; id: string }).id;
	});
});

describe('updatePrice', () => {
	it('stores the latest price with who updated it and when', async () => {
		await tick();
		const result = await updatePrice({ servicePriceId: consultaId, price: 17000 }, STAFF_2.id);
		expect(result).toEqual({ ok: true });

		const [row] = await db.select().from(servicePrices).where(eqId(consultaId));
		expect(row?.price).toBe(17000);
		expect(row?.updatedBy).toBe(STAFF_2.id);
		expect(row?.updatedAt.getTime()).toBeGreaterThan(row?.createdAt.getTime());
		// No change log: the catalog row keeps only the latest price.
		expect(Object.keys(row ?? {})).not.toContain('previousPrice');
	});

	it('exposes the updater name through the list', async () => {
		const rows = await listServicePrices();
		const consulta = rows.find((row) => row.id === consultaId);
		expect(consulta?.updatedByName).toBe(STAFF_2.name);
	});

	it('rejects unknown ids and invalid prices', async () => {
		expect(await updatePrice({ servicePriceId: 'no-existe', price: 100 }, STAFF_1.id)).toEqual({
			ok: false,
			reason: 'not-found'
		});
		expect(await updatePrice({ servicePriceId: consultaId, price: -5 }, STAFF_1.id)).toEqual({
			ok: false,
			reason: 'invalid-input'
		});
	});
});

describe('setActive', () => {
	it('deactivates a type without deleting it and records who', async () => {
		await tick();
		const result = await setActive(limpiezaId, false, STAFF_2.id);
		expect(result).toEqual({ ok: true });

		const [row] = await db.select().from(servicePrices).where(eqId(limpiezaId));
		expect(row?.isActive).toBe(false);
		expect(row?.updatedBy).toBe(STAFF_2.id);
		expect(row?.updatedAt.getTime()).toBeGreaterThan(row?.createdAt.getTime());
	});

	it('keeps a deactivated type resolvable and out of the active lists', async () => {
		expect(await getPriceForService('limpieza')).toMatchObject({ price: 20000, isActive: false });
		const active = await listActiveServicePrices();
		expect(active.map((row) => row.serviceType)).toEqual(['consulta']);
	});

	it('reactivates with the acting staff recorded', async () => {
		await tick();
		expect(await setActive(limpiezaId, true, STAFF_1.id)).toEqual({ ok: true });

		const [row] = await db.select().from(servicePrices).where(eqId(limpiezaId));
		expect(row?.isActive).toBe(true);
		expect(row?.updatedBy).toBe(STAFF_1.id);

		const active = await listActiveServicePrices();
		expect(active.map((row) => row.serviceType)).toEqual(['consulta', 'limpieza']);
	});

	it('rejects unknown ids', async () => {
		expect(await setActive('no-existe', true, STAFF_1.id)).toEqual({
			ok: false,
			reason: 'not-found'
		});
	});
});

describe('hasAllPrices', () => {
	it('accepts an empty selection', async () => {
		expect(await hasAllPrices([])).toEqual({ ok: true });
	});

	it('accepts ids that exist in the catalog', async () => {
		expect(await hasAllPrices([consultaId, limpiezaId])).toEqual({ ok: true });
	});

	it('reports ids that never existed', async () => {
		const result = await hasAllPrices([consultaId, 'sin-catalogo']);
		expect(result).toEqual({ ok: false, missing: ['sin-catalogo'] });
	});

	it('still resolves deactivated types for recorded services', async () => {
		await setActive(limpiezaId, false, STAFF_1.id);
		try {
			expect(await hasAllPrices([consultaId, limpiezaId])).toEqual({ ok: true });
		} finally {
			await setActive(limpiezaId, true, STAFF_1.id);
		}
	});
});

function eqId(id: string) {
	return eq(servicePrices.id, id);
}
