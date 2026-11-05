import { randomUUID } from 'node:crypto';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema.js';
import {
	appointmentServices,
	appointments,
	followUps,
	invoiceHistory,
	patients,
	reminderRecords,
	servicePrices
} from './schema.js';

/**
 * Seeding logic shared by `scripts/seed.ts` (local file database) and the
 * Playwright global setup (local D1 through `wrangler`'s platform proxy).
 *
 * Staff is authenticated by JWT from environment variables (no user table in
 * the database). All seeded records attribute actions to a fixed staff id.
 *
 * Keeps the same data sets as before: one staff identity, the service catalog
 * and synthetic patients/appointments — idempotent on repeated runs.
 */
export type SeedDatabase =
	| DrizzleD1Database<typeof schema>
	| BetterSQLite3Database<typeof schema>;

export interface SeedProfile {
	staffName: string;
	staffEmail: string;
	staffPassword: string;
}

const DEFAULT_PROFILE: SeedProfile = {
	staffName: 'Dra. Laura',
	staffEmail: 'staff@example.com',
	staffPassword: 'change-me-too'
};

/** Fixed staff identity used to attribute seeded records (no DB user table). */
const STAFF_ID = 'staff';

export async function seedDatabase(
	input: SeedDatabase,
	profileOverride?: Partial<SeedProfile>
): Promise<{ staffId: string; staffEmail: string }> {
	// Both drivers expose the same select/insert chain; the union of the two
	// concrete types is shaky for chained generics, so the calls go through
	// one of the two concrete shapes.
	const db = input as DrizzleD1Database<typeof schema>;
	const profile = { ...DEFAULT_PROFILE, ...profileOverride };

	await seedServiceCatalog(db, STAFF_ID);
	await seedSyntheticData(db, STAFF_ID);

	return { staffId: STAFF_ID, staffEmail: profile.staffEmail };
}

/** Service type catalog. Permanent reference data; seeded once, never re-priced here. */
async function seedServiceCatalog(
	db: DrizzleD1Database<typeof schema>,
	staffId: string
): Promise<void> {
	const catalogRows = [
		{ serviceType: 'consulta', name: 'Consulta', price: 15000 },
		{ serviceType: 'limpieza', name: 'Limpieza / profilaxis', price: 20000 },
		{ serviceType: 'empaste', name: 'Empaste simple', price: 25000 },
		{ serviceType: 'extraccion', name: 'Extracción simple', price: 30000 },
		{ serviceType: 'blanqueamiento', name: 'Blanqueamiento', price: 45000 }
	];

	const existingCatalog = await db.select({ id: servicePrices.id }).from(servicePrices);
	if (existingCatalog.length > 0) return;

	await db.insert(servicePrices).values(
		catalogRows.map((row) => ({
			id: randomUUID(),
			serviceType: row.serviceType,
			name: row.name,
			price: row.price,
			updatedBy: staffId
		}))
	);
}

/** Argentina is UTC-3 all year. */
function atART(daysFromNow: number, hour: number, minute = 0) {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() + daysFromNow);
	date.setUTCHours(hour + 3, minute, 0, 0);
	return date;
}

async function seedSyntheticData(
	db: DrizzleD1Database<typeof schema>,
	staffId: string
): Promise<void> {
	const [existingPatient] = await db.select({ id: patients.id }).from(patients).limit(1);
	if (existingPatient) return;

	// Resolve catalog ids from the database so appointment services
	// always point at real rows.
	const catalogIds = new Map(
		(
			await db
				.select({ id: servicePrices.id, serviceType: servicePrices.serviceType })
				.from(servicePrices)
		).map((row) => [row.serviceType, row.id])
	);

	const lucia = randomUUID();
	const mateo = randomUUID();
	const sofia = randomUUID();

	await db.insert(patients).values([
		{
			id: lucia,
			name: 'Lucía Fernández',
			phone: '+5491155550001',
			phoneVerifiedAt: atART(-5, 10),
			whatsappConsent: 'granted',
			consentSource: 'registration',
			consentTextVersion: 1,
			consentRecordedAt: atART(-5, 10),
			registeredAt: atART(-5, 10)
		},
		{
			id: mateo,
			name: 'Mateo Ramírez',
			phone: '+5491155550002',
			whatsappConsent: 'granted',
			consentSource: 'registration',
			consentTextVersion: 1,
			consentRecordedAt: atART(-3, 16),
			registeredAt: atART(-3, 16)
		},
		{
			id: sofia,
			name: 'Sofía Duarte',
			phone: '+5491144440002',
			phoneVerifiedAt: atART(-10, 9),
			whatsappConsent: 'denied',
			registeredAt: atART(-10, 9)
		}
	]);

	const firstAppointment = randomUUID();
	const attendedAppointment = randomUUID(); // 10 days ago, attended, with services
	const pastOngoingTreatment = randomUUID(); // 21 days ago, attended, no services yet

	await db.insert(appointments).values([
		// Past + attended + with recorded services: invoice-ready example.
		{
			id: attendedAppointment,
			patientId: lucia,
			googleCalendarId: 'fake-calendar',
			googleEventId: 'dev-event-5',
			summary: 'Turno — Lucía Fernández',
			startsAt: atART(-10, 10),
			endsAt: atART(-10, 10, 45),
			attendanceStatus: 'attended',
			outcomeRecordedBy: staffId,
			outcomeRecordedAt: atART(-10, 11)
		},
		// Past + attended + without services: shows the "add services" empty state.
		{
			id: pastOngoingTreatment,
			patientId: mateo,
			googleCalendarId: 'fake-calendar',
			googleEventId: 'dev-event-6',
			summary: 'Turno — Mateo Ramírez',
			startsAt: atART(-21, 15, 30),
			endsAt: atART(-21, 16, 15),
			attendanceStatus: 'attended',
			outcomeRecordedBy: staffId,
			outcomeRecordedAt: atART(-21, 16)
		},
		{
			id: firstAppointment,
			patientId: lucia,
			googleCalendarId: 'fake-calendar',
			googleEventId: 'dev-event-1',
			summary: 'Turno — Lucía Fernández',
			startsAt: atART(1, 10),
			endsAt: atART(1, 10, 45),
			attendanceStatus: 'confirmed',
			confirmedAt: atART(-1, 12)
		},
		{
			id: randomUUID(),
			patientId: mateo,
			googleCalendarId: 'fake-calendar',
			googleEventId: 'dev-event-2',
			summary: 'Turno — Mateo Ramírez',
			startsAt: atART(2, 15, 30),
			endsAt: atART(2, 16, 15)
		},
		{
			id: randomUUID(),
			patientId: sofia,
			googleCalendarId: 'fake-calendar',
			googleEventId: 'dev-event-3',
			summary: 'Turno — Sofía Duarte',
			startsAt: atART(5, 9),
			endsAt: atART(5, 9, 45)
		},
		{
			id: randomUUID(),
			patientId: null,
			googleCalendarId: 'fake-calendar',
			googleEventId: 'dev-event-4',
			summary: 'Turno',
			startsAt: atART(3, 11, 30),
			endsAt: atART(3, 12, 15)
		}
	]);

	const consultaId = catalogIds.get('consulta')!;
	const limpiezaId = catalogIds.get('limpieza')!;

	await db.insert(appointmentServices).values([
		{
			id: randomUUID(),
			appointmentId: attendedAppointment,
			servicePriceId: consultaId,
			quantity: 1,
			addedBy: staffId
		},
		{
			id: randomUUID(),
			appointmentId: attendedAppointment,
			servicePriceId: limpiezaId,
			quantity: 1,
			addedBy: staffId
		}
	]);

	// Invoice snapshot for the attended appointment (prices at generation time).
	await db.insert(invoiceHistory).values({
		id: randomUUID(),
		appointmentId: attendedAppointment,
		patientId: lucia,
		patientName: 'Lucía Fernández',
		patientPhone: '+5491155550001',
		appointmentStartsAt: atART(-10, 10),
		services: [
			{ serviceType: 'consulta', name: 'Consulta', price: 15000, quantity: 1, subtotal: 15000 },
			{
				serviceType: 'limpieza',
				name: 'Limpieza / profilaxis',
				price: 20000,
				quantity: 1,
				subtotal: 20000
			}
		],
		subtotal: 35000,
		total: 35000,
		createdBy: staffId,
		status: 'sent',
		sentAt: atART(-9, 12)
	});

	await db.insert(reminderRecords).values([
		{
			id: randomUUID(),
			appointmentId: firstAppointment,
			purpose: 'reminder',
			templateKey: 'initial',
			status: 'sent',
			recordedBy: staffId,
			recordedAt: atART(-1, 12)
		},
		{
			id: randomUUID(),
			appointmentId: attendedAppointment,
			purpose: 'invoice',
			templateKey: 'invoice',
			status: 'sent',
			recordedBy: staffId,
			recordedAt: atART(-9, 12)
		}
	]);

	await db.insert(followUps).values({
		id: randomUUID(),
		patientId: sofia,
		description: 'Coordinar la segunda sesión del tratamiento',
		dueAt: atART(3, 9),
		status: 'open',
		assignedTo: staffId,
		lastContactAt: atART(-1, 10)
	});
}
