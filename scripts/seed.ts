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
const { appointments, followUps, patients, reminderRecords, user } =
	await import('../src/lib/server/db/schema');

const dentistName = process.env.SEED_DENTIST_NAME ?? 'Dra. Laura';
const dentistEmail = process.env.SEED_DENTIST_EMAIL ?? 'dentist@example.com';
const dentistPassword = process.env.SEED_DENTIST_PASSWORD ?? 'change-me-too';
const assistantName = process.env.SEED_ASSISTANT_NAME ?? 'Asistente';
const assistantEmail = process.env.SEED_ASSISTANT_EMAIL ?? 'assistant@example.com';
const assistantPassword = process.env.SEED_ASSISTANT_PASSWORD ?? 'change-me-too';

async function ensureUser(name: string, email: string, password: string) {
	const existing = await db.select().from(user).where(eq(user.email, email)).limit(1);
	if (existing.length > 0) return existing[0];

	await auth.api.signUpEmail({ body: { name, email, password } });

	const created = await db.select().from(user).where(eq(user.email, email)).limit(1);
	if (created.length === 0) throw new Error(`No se pudo crear el usuario ${email}`);
	return created[0];
}

/** Argentina is UTC-3 all year. */
function atART(daysFromNow: number, hour: number, minute = 0) {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() + daysFromNow);
	date.setUTCHours(hour + 3, minute, 0, 0);
	return date;
}

const dentist = await ensureUser(dentistName, dentistEmail, dentistPassword);
const assistant = await ensureUser(assistantName, assistantEmail, assistantPassword);

const existingPatients = await db.select({ id: patients.id }).from(patients).limit(1);

if (existingPatients.length > 0) {
	console.log('Datos sintéticos ya presentes; no se duplican.');
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
			phone: '+525512345678',
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
			whatsappConsent: 'unknown',
			registeredAt: atART(-10, 9)
		}
	]);

	const firstAppointment = randomUUID();

	await db.insert(appointments).values([
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

	await db.insert(reminderRecords).values({
		id: randomUUID(),
		appointmentId: firstAppointment,
		purpose: 'reminder',
		templateKey: 'initial',
		status: 'sent',
		recordedBy: assistant.id,
		recordedAt: atART(-1, 12)
	});

	await db.insert(followUps).values({
		id: randomUUID(),
		patientId: sofia,
		description: 'Coordinar la segunda sesión del tratamiento',
		dueAt: atART(3, 9),
		status: 'open',
		assignedTo: assistant.id,
		lastContactAt: atART(-1, 10)
	});
}

console.log(`Listo. Personal: ${dentist.email}, ${assistant.email}`);
