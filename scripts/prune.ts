import { lt, and, isNotNull, ne, or } from 'drizzle-orm';

try {
	process.loadEnvFile('.env');
} catch {
	// No .env file; defaults apply.
}

const { db } = await import('../src/lib/server/db');
const { appointments, reminderRecords } = await import('../src/lib/server/db/schema');

const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
const cutoff = new Date(Date.now() - ninetyDaysMs);

const deletedReminders = await db.delete(reminderRecords).where(lt(reminderRecords.recordedAt, cutoff)).returning({ id: reminderRecords.id });
console.log(`Recordatorios eliminados: ${deletedReminders.length}`);

const deletedAppointments = await db
	.delete(appointments)
	.where(
		and(
			lt(appointments.startsAt, cutoff),
			or(
				isNotNull(appointments.outcomeRecordedAt),
				ne(appointments.attendanceStatus, 'scheduled')
			)
		)
	)
	.returning({ id: appointments.id });
console.log(`Turnos eliminados: ${deletedAppointments.length}`);

console.log('Listo.');
