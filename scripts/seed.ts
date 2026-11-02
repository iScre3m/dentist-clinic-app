import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

try {
	process.loadEnvFile('.env');
} catch {
	// No .env file; defaults apply.
}

if (process.env.NODE_ENV === 'production') {
	console.error('db:seed no se ejecuta con NODE_ENV=production.');
	process.exit(1);
}

const { db } = await import('../src/lib/server/db');
const { auth } = await import('../src/lib/server/auth');
const {
	appointmentServices,
	appointments,
	followUps,
	invoiceHistory,
	patients,
	reminderRecords,
	servicePrices,
	user
} = await import('../src/lib/server/db/schema');

const staffName = process.env.SEED_STAFF_NAME ?? 'Dra. Laura';
const staffEmail = process.env.SEED_STAFF_EMAIL ?? 'staff@example.com';
const staffPassword = process.env.SEED_STAFF_PASSWORD ?? 'change-me-too';

async function ensureUser(name: string, email: string, password: string) {
	const existing = await db.select().from(user).where(eq(user.email, email)).limit(1);
	if (existing.length > 0) return existing[0];

	await auth.api.signUpEmail({ body: { name, email, password } });

	const created = await db.select().from(user).where(eq(user.email, email)).limit(1);
	if (created.length === 0) throw new Error('No se pudo crear el usuario ' + email);
	return created[0];
}

/** Argentina is UTC-3 all year. */
function atART(daysFromNow: number, hour: number, minute = 0) {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() + daysFromNow);
	date.setUTCHours(hour + 3, minute, 0, 0);
	return date;
}

const staff = await ensureUser(staffName, staffEmail, staffPassword);

// Service type catalog. Permanent reference data; seeded once, never re-priced here.
const catalogRows = [
	{ serviceType: 'consulta', name: 'Consulta', price: 15000 },
	{ serviceType: 'limpieza', name: 'Limpieza / profilaxis', price: 20000 },
	{ serviceType: 'empaste', name: 'Empaste simple', price: 25000 },
	{ serviceType: 'extraccion', name: 'Extracción simple', price: 30000 },
	{ serviceType: 'blanqueamiento', name: 'Blanqueamiento', price: 45000 }
];

const existingCatalog = await db
	.select({ id: servicePrices.id, serviceType: servicePrices.serviceType })
	.from(servicePrices);
if (existingCatalog.length > 0) {
	console.log('El catálogo de prácticas ya está presente; no se duplica.');
} else {
	await db.insert(servicePrices).values(
		catalogRows.map((row) => ({
			id: randomUUID(),
			serviceType: row.serviceType,
			name: row.name,
			price: row.price,
			updatedBy: staff.id
		}))
	);
	console.log(`Catálogo de prácticas creado: ${catalogRows.length} tipos.`);
}

// Resolve catalog ids from the database so appointment services always point at real rows.
const catalogIds = new Map(
	(
		await db
			.select({ id: servicePrices.id, serviceType: servicePrices.serviceType })
			.from(servicePrices)
	).map((row) => [row.serviceType, row.id])
);

const existingPatients = await db.select({ id: patients.id }).from(patients).limit(1);

if (existingPatients.length > 0) {
	console.log('Los datos sintéticos ya están presentes; no se duplican.');
} else {
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
			outcomeRecordedBy: staff.id,
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
			outcomeRecordedBy: staff.id,
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
			addedBy: staff.id
		},
		{
			id: randomUUID(),
			appointmentId: attendedAppointment,
			servicePriceId: limpiezaId,
			quantity: 1,
			addedBy: staff.id
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
		createdBy: staff.id,
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
			recordedBy: staff.id,
			recordedAt: atART(-1, 12)
		},
		{
			id: randomUUID(),
			appointmentId: attendedAppointment,
			purpose: 'invoice',
			templateKey: 'invoice',
			status: 'sent',
			recordedBy: staff.id,
			recordedAt: atART(-9, 12)
		}
	]);

	await db.insert(followUps).values({
		id: randomUUID(),
		patientId: sofia,
		description: 'Coordinar la segunda sesión del tratamiento',
		dueAt: atART(3, 9),
		status: 'open',
		assignedTo: staff.id,
		lastContactAt: atART(-1, 10)
	});
}

console.log(`Listo. Personal: ${staff.email}`);
