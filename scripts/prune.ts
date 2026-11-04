import { lt, and, isNotNull, ne, or } from 'drizzle-orm';

try {
	process.loadEnvFile('.env');
} catch {
	// No .env file; defaults apply.
}

const { db } = await import('../src/lib/server/db/local');
const { appointmentServices, appointments, invoiceHistory, reminderRecords } =
	await import('../src/lib/server/db/schema');

const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
const cutoff = new Date(Date.now() - ninetyDaysMs);

const deletedReminders = await db
	.delete(reminderRecords)
	.where(lt(reminderRecords.recordedAt, cutoff))
	.returning({ id: reminderRecords.id });
console.log(`Recordatorios eliminados: ${deletedReminders.length}`);

const deletedAppointments = await db
	.delete(appointments)
	.where(
		and(
			lt(appointments.startsAt, cutoff),
			or(isNotNull(appointments.outcomeRecordedAt), ne(appointments.attendanceStatus, 'scheduled'))
		)
	)
	.returning({ id: appointments.id });
console.log(`Turnos eliminados: ${deletedAppointments.length}`);

// Appointments deleted above take their appointment_services via cascade; also sweep services
// still attached to unresolved appointments that are older than the cutoff.
const deletedServices = await db
	.delete(appointmentServices)
	.where(lt(appointmentServices.createdAt, cutoff))
	.returning({ id: appointmentServices.id });
console.log(`Servicios de turnos eliminados: ${deletedServices.length}`);

const deletedInvoices = await db
	.delete(invoiceHistory)
	.where(lt(invoiceHistory.createdAt, cutoff))
	.returning({ id: invoiceHistory.id });
console.log(`Facturas eliminadas: ${deletedInvoices.length}`);

console.log('Listo. El catálogo de prácticas (service_prices) nunca se elimina.');
