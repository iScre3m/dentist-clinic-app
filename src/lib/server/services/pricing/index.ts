import { randomUUID } from 'node:crypto';
import { db } from '#lib/server/db/index.ts';
import { servicePrices } from '#lib/server/db/schema.ts';
import type { ServicePrice } from '#lib/server/db/schema.ts';
import { asc, desc, eq, inArray } from 'drizzle-orm';

export type CreateServicePriceInput = {
	serviceType: string;
	name: string;
	price: number;
};

export type CreateServicePriceResult =
	{ ok: true; id: string } | { ok: false; reason: 'duplicate-type' | 'invalid-input' };

export type UpdateServicePriceInput = {
	servicePriceId: string;
	price: number;
};

export type UpdateServicePriceResult =
	{ ok: true } | { ok: false; reason: 'not-found' | 'invalid-input' };

export type SetActiveResult = { ok: true } | { ok: false; reason: 'not-found' };

export type ServicePriceRow = ServicePrice;

/** All service types, active first, each with the name of the staff that last updated it. */
export async function listServicePrices(): Promise<ServicePriceRow[]> {
	return db
		.select({
			id: servicePrices.id,
			serviceType: servicePrices.serviceType,
			name: servicePrices.name,
			price: servicePrices.price,
			isActive: servicePrices.isActive,
			updatedBy: servicePrices.updatedBy,
			updatedAt: servicePrices.updatedAt,
			createdAt: servicePrices.createdAt,
		})
		.from(servicePrices)

		.orderBy(desc(servicePrices.isActive), asc(servicePrices.name));
}

/** Active service types for the multi-select on the invoice page. */
export async function listActiveServicePrices() {
	return db
		.select({
			id: servicePrices.id,
			serviceType: servicePrices.serviceType,
			name: servicePrices.name,
			price: servicePrices.price
		})
		.from(servicePrices)
		.where(eq(servicePrices.isActive, true))
		.orderBy(asc(servicePrices.name));
}

export async function getPriceForService(serviceType: string) {
	const [row] = await db
		.select()
		.from(servicePrices)
		.where(eq(servicePrices.serviceType, serviceType))
		.limit(1);
	return row ?? null;
}

/**
 * Price guard used before invoice generation. A type counts as priced whenever
 * a catalog row exists — deactivated types stay resolvable for services that
 * were already recorded on an appointment (see Requirement 1.5).
 *
 * Note on `missing`: because `appointment_services.service_price_id` has an
 * FK with ON DELETE RESTRICT into the permanent catalog, an id can only be
 * "missing" if it never existed — so ids are diagnostics, and the UI shows a
 * generic "prácticas sin precio" message pointing at /precios.
 */
export async function hasAllPrices(
	servicePriceIds: string[]
): Promise<{ ok: true } | { ok: false; missing: string[] }> {
	if (servicePriceIds.length === 0) return { ok: true };

	const rows = await db
		.select({ id: servicePrices.id })
		.from(servicePrices)
		.where(inArray(servicePrices.id, servicePriceIds));

	const priced = new Set(rows.map((row) => row.id));
	const missing = servicePriceIds.filter((id) => !priced.has(id));

	if (missing.length === 0) return { ok: true };
	return { ok: false, missing };
}

/**
 * Set a new current price. There is deliberately no change-log table: invoices
 * always snapshot prices at generation time, so the row keeps only the latest
 * price with who updated it and when.
 */
export async function updatePrice(
	input: UpdateServicePriceInput,
	staffId: string
): Promise<UpdateServicePriceResult> {
	if (!Number.isInteger(input.price) || input.price < 0) {
		return { ok: false, reason: 'invalid-input' };
	}

	const now = new Date();
	const updated = await db
		.update(servicePrices)
		.set({ price: input.price, updatedBy: staffId, updatedAt: now })
		.where(eq(servicePrices.id, input.servicePriceId))
		.returning({ id: servicePrices.id });

	if (updated.length === 0) return { ok: false, reason: 'not-found' };
	return { ok: true };
}

/** Add a new service type to the permanent catalog. */
export async function createServicePrice(
	input: CreateServicePriceInput,
	staffId: string
): Promise<CreateServicePriceResult> {
	const serviceType = input.serviceType.trim().toLowerCase();
	const name = input.name.trim();
	if (
		serviceType.length < 2 ||
		name.length < 2 ||
		!Number.isInteger(input.price) ||
		input.price < 0
	) {
		return { ok: false, reason: 'invalid-input' };
	}

	const existing = await db
		.select({ id: servicePrices.id })
		.from(servicePrices)
		.where(eq(servicePrices.serviceType, serviceType))
		.limit(1);
	if (existing.length > 0) return { ok: false, reason: 'duplicate-type' };

	const id = randomUUID();
	const now = new Date();
	await db.insert(servicePrices).values({
		id,
		serviceType,
		name,
		price: input.price,
		isActive: true,
		updatedBy: staffId,
		createdAt: now,
		updatedAt: now
	});
	return { ok: true, id };
}

/**
 * Stop offering a service type. The row itself is permanent: deactivation only
 * hides it from the multi-select while keeping it resolvable for history.
 */
export async function setActive(
	servicePriceId: string,
	isActive: boolean,
	staffId: string
): Promise<SetActiveResult> {
	const updated = await db
		.update(servicePrices)
		.set({ isActive, updatedBy: staffId, updatedAt: new Date() })
		.where(eq(servicePrices.id, servicePriceId))
		.returning({ id: servicePrices.id });

	if (updated.length === 0) return { ok: false, reason: 'not-found' };
	return { ok: true };
}
