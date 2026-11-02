import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { InvoiceData } from '#lib/server/services/invoices/index.ts';

/**
 * DB-backed unit tests for the invoice service.
 *
 * Same isolated-database pattern as `pricing/index.test.ts`: a temp file is
 * pinned to `DATABASE_PATH` before importing any server module, and migrations
 * run first through a separate connection. The clinic env read
 * (`getClinicInfo`) is lazy, so importing the service never needs it.
 */

const tempDir = mkdtempSync(join(tmpdir(), 'dentist-invoices-'));
const databasePath = join(tempDir, 'test.db');
process.env.DATABASE_PATH = databasePath;

const migrationDb = new Database(databasePath);
migrationDb.pragma('journal_mode = WAL');
migrate(drizzle(migrationDb), { migrationsFolder: resolve('drizzle') });
migrationDb.close();

const { db } = await import('#lib/server/db/index.ts');
const {
	appointmentServices,
	appointments,
	invoiceHistory,
	patients,
	reminderRecords,
	servicePrices,
	user
} = await import('#lib/server/db/schema.ts');
const {
	addService,
	buildInvoiceMessage,
	generateInvoice,
	getInvoiceData,
	listInvoicesByAppointment,
	listInvoicesByPatient,
	markSent,
	markSkipped,
	removeService,
	resendInvoice,
	setQuantity
} = await import('#lib/server/services/invoices/index.ts');

const STAFF_1 = { id: 'staff-1', name: 'Dra. Laura', email: 'laura@test.local' };
const STAFF_2 = { id: 'staff-2', name: 'Asistente Ana', email: 'ana@test.local' };

const CALENDAR = 'fake-calendar';

function tick(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 30));
}

let patientActivoId: string;
let patientArchivadoId: string;
let consultaId: string;
let empasteId: string;

async function createAppointment(options: {
	patientId: string | null;
	startsAt?: Date;
	allDay?: boolean;
	calendarStatus?: 'confirmed' | 'cancelled' | 'deleted';
}): Promise<string> {
	const hasTime = options.startsAt !== undefined;
	const id = randomUUID();
	await db.insert(appointments).values({
		id,
		patientId: options.patientId,
		googleCalendarId: CALENDAR,
		googleEventId: randomUUID(),
		summary: 'Turno de prueba',
		allDay: options.allDay ?? !hasTime,
		localDate: hasTime ? undefined : '2026-01-01',
		startsAt: options.startsAt ?? null,
		endsAt: options.startsAt ? new Date(options.startsAt.getTime() + 30 * 60 * 1000) : null,
		calendarStatus: options.calendarStatus ?? 'confirmed'
	});
	return id;
}

function pastDate(): Date {
	return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

function futureDate(): Date {
	return new Date(Date.now() + 25 * 60 * 60 * 1000);
}

beforeAll(async () => {
	await db.insert(user).values([STAFF_1, STAFF_2]);

	const [activo] = await db
		.insert(patients)
		.values({
			id: randomUUID(),
			name: 'Ana Prácticas',
			phone: '+5491155550101',
			whatsappConsent: 'granted',
			consentSource: 'registration'
		})
		.returning({ id: patients.id });
	patientActivoId = activo!.id;

	const [archivado] = await db
		.insert(patients)
		.values({
			id: randomUUID(),
			name: 'Bob Archivado',
			phone: '+5491155550102',
			whatsappConsent: 'denied',
			archivedAt: new Date()
		})
		.returning({ id: patients.id });
	patientArchivadoId = archivado!.id;

	const [consulta] = await db
		.insert(servicePrices)
		.values({
			id: randomUUID(),
			serviceType: 'consulta',
			name: 'Consulta',
			price: 15000,
			isActive: true,
			updatedBy: STAFF_1.id
		})
		.returning({ id: servicePrices.id });
	consultaId = consulta!.id;

	const [empaste] = await db
		.insert(servicePrices)
		.values({
			id: randomUUID(),
			serviceType: 'empaste',
			name: 'Empaste simple',
			price: 25000,
			isActive: true,
			updatedBy: STAFF_1.id
		})
		.returning({ id: servicePrices.id });
	empasteId = empaste!.id;
});

afterAll(() => {
	try {
		rmSync(tempDir);
	} catch {
		// The singleton connection keeps the file open on Windows; OS temp cleans up.
	}
});

describe('addService guards', () => {
	it('rejects unknown appointments, unlinked and archived patients', async () => {
		expect(await addService('no-existe', consultaId, 1, STAFF_1.id)).toEqual({
			ok: false,
			reason: 'appointment-not-found'
		});

		const sinPaciente = await createAppointment({ patientId: null, startsAt: pastDate() });
		expect(await addService(sinPaciente, consultaId, 1, STAFF_1.id)).toEqual({
			ok: false,
			reason: 'no-patient'
		});

		const archivado = await createAppointment({
			patientId: patientArchivadoId,
			startsAt: pastDate()
		});
		expect(await addService(archivado, consultaId, 1, STAFF_1.id)).toEqual({
			ok: false,
			reason: 'patient-archived'
		});
	});

	it('rejects unknown services and invalid quantities', async () => {
		const appointment = await createAppointment({
			patientId: patientActivoId,
			startsAt: pastDate()
		});
		expect(await addService(appointment, 'sin-precio', 1, STAFF_1.id)).toEqual({
			ok: false,
			reason: 'service-not-found'
		});
		expect(await addService(appointment, consultaId, 0, STAFF_1.id)).toEqual({
			ok: false,
			reason: 'invalid-input'
		});
		expect(await addService(appointment, consultaId, 1.5, STAFF_1.id)).toEqual({
			ok: false,
			reason: 'invalid-input'
		});
		expect(await addService(appointment, consultaId, 100, STAFF_1.id)).toEqual({
			ok: false,
			reason: 'invalid-input'
		});
		const rows = await db.select().from(appointmentServices);
		expect(rows).toHaveLength(0);
	});
});

describe('addService upsert on reselect', () => {
	it('accumulates quantity on the same row instead of duplicating', async () => {
		const appointment = await createAppointment({
			patientId: patientActivoId,
			startsAt: pastDate()
		});

		const first = await addService(appointment, consultaId, 1, STAFF_1.id);
		const second = await addService(appointment, consultaId, 2, STAFF_1.id);

		expect(
			second.ok && first.ok && second.appointmentServiceId === first.appointmentServiceId
		).toBe(true);
		expect(second).toEqual({
			ok: true,
			appointmentServiceId: first.ok ? first.appointmentServiceId : '',
			quantity: 3
		});

		const rows = await db.select().from(appointmentServices);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.quantity).toBe(3);
	});

	it('blocks selections that would push the total past the cap without mutating', async () => {
		const appointment = await createAppointment({
			patientId: patientActivoId,
			startsAt: pastDate()
		});
		await addService(appointment, empasteId, 98, STAFF_1.id);

		const result = await addService(appointment, empasteId, 2, STAFF_1.id);
		expect(result).toEqual({ ok: false, reason: 'limit-reached' });

		const rows = await db
			.select()
			.from(appointmentServices)
			.where(eq(appointmentServices.appointmentId, appointment));
		expect(rows).toHaveLength(1);
		expect(rows[0]?.quantity).toBe(98);
	});
});

describe('removeService and setQuantity', () => {
	it('edits and deletes recorded services', async () => {
		const appointment = await createAppointment({
			patientId: patientActivoId,
			startsAt: pastDate()
		});
		const added = await addService(appointment, empasteId, 3, STAFF_1.id);
		const serviceId = added.ok ? added.appointmentServiceId : '';

		expect(await setQuantity(serviceId, 2)).toEqual({ ok: true });
		const [row] = await db
			.select()
			.from(appointmentServices)
			.where(eq(appointmentServices.id, serviceId));
		expect(row?.quantity).toBe(2);

		expect(await setQuantity(serviceId, 0)).toEqual({ ok: false, reason: 'invalid-input' });
		expect(await setQuantity('no-existe', 1)).toEqual({ ok: false, reason: 'not-found' });

		await removeService(serviceId);
		const left = await db
			.select()
			.from(appointmentServices)
			.where(eq(appointmentServices.id, serviceId));
		expect(left).toHaveLength(0);
		expect(await removeService(serviceId)).toEqual({ ok: false, reason: 'not-found' });
	});
});

describe('invoice guard chain', () => {
	it('rejects unknown, cancelled, future and all-day appointments', async () => {
		expect(await getInvoiceData('no-existe')).toEqual({
			ok: false,
			reason: 'appointment-not-found'
		});

		const cancelled = await createAppointment({
			patientId: patientActivoId,
			startsAt: pastDate(),
			calendarStatus: 'cancelled'
		});
		expect(await getInvoiceData(cancelled)).toEqual({ ok: false, reason: 'cancelled' });

		const future = await createAppointment({ patientId: patientActivoId, startsAt: futureDate() });
		expect(await getInvoiceData(future)).toEqual({ ok: false, reason: 'future' });

		const allDay = await createAppointment({ patientId: patientActivoId });
		expect(await getInvoiceData(allDay)).toEqual({ ok: false, reason: 'all-day' });
	});

	it('rejects unlinked and archived patients', async () => {
		const sinPaciente = await createAppointment({ patientId: null, startsAt: pastDate() });
		expect(await getInvoiceData(sinPaciente)).toEqual({ ok: false, reason: 'no-patient' });

		const archivado = await createAppointment({
			patientId: patientArchivadoId,
			startsAt: pastDate()
		});
		expect(await getInvoiceData(archivado)).toEqual({ ok: false, reason: 'patient-archived' });
	});

	it('requires at least one recorded service', async () => {
		const appointment = await createAppointment({
			patientId: patientActivoId,
			startsAt: pastDate()
		});
		expect(await getInvoiceData(appointment)).toEqual({ ok: false, reason: 'no-services' });
	});

	it('passes with a valid patient and timed past appointment', async () => {
		const appointment = await createAppointment({
			patientId: patientActivoId,
			startsAt: pastDate()
		});
		await addService(appointment, consultaId, 1, STAFF_1.id);

		const result = await getInvoiceData(appointment);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data.patient.id).toBe(patientActivoId);
		expect(result.data.patient.name).toBe('Ana Prácticas');
	});

	it('flags orphaned service references as missing prices (diagnostics)', async () => {
		const appointment = await createAppointment({
			patientId: patientActivoId,
			startsAt: pastDate()
		});
		// The FK with ON DELETE RESTRICT makes this state unreachable in real flows;
		// simulate the orphan to prove the diagnostic path.
		const orphanDb = new Database(databasePath);
		orphanDb.pragma('foreign_keys = OFF');
		orphanDb
			.prepare(
				'insert into appointment_services (id, appointment_id, service_price_id, quantity, added_by, created_at, updated_at) values (?, ?, ?, 1, ?, ?, ?)'
			)
			.run(randomUUID(), appointment, 'precio-eliminado', STAFF_1.id, Date.now(), Date.now());
		orphanDb.close();

		const result = await getInvoiceData(appointment);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.reason).toBe('missing-prices');
		expect(result.missingPriceIds).toEqual(['precio-eliminado']);
	});
});

describe('generateInvoice snapshot integrity and totals', () => {
	it('stores the itemized prices current at generation time with correct totals', async () => {
		const startsAt = pastDate();
		const appointment = await createAppointment({ patientId: patientActivoId, startsAt });
		await addService(appointment, consultaId, 1, STAFF_1.id);
		await addService(appointment, empasteId, 2, STAFF_1.id);

		const generated = await generateInvoice(appointment, STAFF_1.id);
		expect(generated.ok).toBe(true);
		if (!generated.ok) return;

		const { invoice } = generated;
		expect(invoice.status).toBe('generated');
		expect(invoice.patientName).toBe('Ana Prácticas');
		expect(invoice.patientPhone).toBe('+5491155550101');
		expect(invoice.appointmentStartsAt.getTime()).toBe(startsAt.getTime());
		expect(invoice.subtotal).toBe(65000);
		expect(invoice.total).toBe(65000);
		expect(invoice.services).toEqual([
			{ serviceType: 'consulta', name: 'Consulta', price: 15000, quantity: 1, subtotal: 15000 },
			{
				serviceType: 'empaste',
				name: 'Empaste simple',
				price: 25000,
				quantity: 2,
				subtotal: 50000
			}
		]);
	});

	it('keeps every snapshot untouched by later catalog changes', async () => {
		const appointment = await createAppointment({
			patientId: patientActivoId,
			startsAt: pastDate()
		});
		await addService(appointment, consultaId, 1, STAFF_1.id);

		const first = await generateInvoice(appointment, STAFF_1.id);
		expect(first.ok).toBe(true);

		// Catalog moves afterwards: prices change, snapshots do not.
		await db.update(servicePrices).set({ price: 17000 }).where(eq(servicePrices.id, consultaId));

		const [fetched] = await db
			.select()
			.from(invoiceHistory)
			.where(eq(invoiceHistory.id, first.ok ? first.invoice.id : ''));
		expect(fetched?.total).toBe(15000);
		expect(fetched?.services).toEqual([
			{ serviceType: 'consulta', name: 'Consulta', price: 15000, quantity: 1, subtotal: 15000 }
		]);

		const second = await generateInvoice(appointment, STAFF_1.id);
		if (!second.ok) {
			expect.unreachable();
			return;
		}
		expect(second.invoice.total).toBe(17000);
	});

	it('restores the catalog price used by later tests', async () => {
		await db.update(servicePrices).set({ price: 15000 }).where(eq(servicePrices.id, consultaId));
		const [row] = await db.select().from(servicePrices).where(eq(servicePrices.id, consultaId));
		expect(row?.price).toBe(15000);
	});
});

describe('markSent records confirmation only after user action', () => {
	it('flips only the invoice row through markSent; generation never records a send', async () => {
		const appointment = await createAppointment({
			patientId: patientActivoId,
			startsAt: pastDate()
		});
		await addService(appointment, consultaId, 1, STAFF_1.id);
		const generated = await generateInvoice(appointment, STAFF_1.id);
		if (!generated.ok) {
			expect.unreachable();
			return;
		}
		const invoiceId = generated.invoice.id;

		// Generation alone did not touch reminder_records.
		let records = await db
			.select()
			.from(reminderRecords)
			.where(eq(reminderRecords.appointmentId, appointment));
		expect(records).toHaveLength(0);

		expect(await markSent(invoiceId, STAFF_2.id)).toEqual({ ok: true });

		const [invoice] = await db
			.select()
			.from(invoiceHistory)
			.where(eq(invoiceHistory.id, invoiceId));
		expect(invoice?.status).toBe('sent');
		expect(invoice?.sentAt).toBeTruthy();

		records = await db
			.select()
			.from(reminderRecords)
			.where(eq(reminderRecords.appointmentId, appointment));
		expect(records).toHaveLength(1);
		expect(records[0]?.purpose).toBe('invoice');
		expect(records[0]?.templateKey).toBe('invoice');
		expect(records[0]?.status).toBe('sent');
		expect(records[0]?.recordedBy).toBe(STAFF_2.id);

		expect(await markSent(invoiceId, STAFF_2.id)).toEqual({ ok: false, reason: 'already-sent' });
		records = await db
			.select()
			.from(reminderRecords)
			.where(eq(reminderRecords.appointmentId, appointment));
		expect(records).toHaveLength(1);
	});

	it('markSkipped keeps the invoice generated and logs the skip', async () => {
		const appointment = await createAppointment({
			patientId: patientActivoId,
			startsAt: pastDate()
		});
		await addService(appointment, consultaId, 1, STAFF_1.id);
		const generated = await generateInvoice(appointment, STAFF_1.id);
		if (!generated.ok) {
			expect.unreachable();
			return;
		}

		expect(await markSkipped(generated.invoice.id, STAFF_1.id)).toEqual({ ok: true });

		const [invoice] = await db
			.select()
			.from(invoiceHistory)
			.where(eq(invoiceHistory.id, generated.invoice.id));
		expect(invoice?.status).toBe('generated');
		expect(invoice?.sentAt).toBeNull();

		const records = await db
			.select()
			.from(reminderRecords)
			.where(eq(reminderRecords.appointmentId, appointment));
		expect(records).toHaveLength(1);
		expect(records[0]?.status).toBe('skipped');
		expect(records[0]?.purpose).toBe('invoice');

		expect(await markSkipped('no-existe', STAFF_1.id)).toEqual({ ok: false, reason: 'not-found' });
	});
});

describe('resendInvoice', () => {
	it('requires a written reason and rejects blank input', async () => {
		const appointment = await createAppointment({
			patientId: patientActivoId,
			startsAt: pastDate()
		});
		await addService(appointment, consultaId, 1, STAFF_1.id);
		const generated = await generateInvoice(appointment, STAFF_1.id);
		if (!generated.ok) {
			expect.unreachable();
			return;
		}
		await markSent(generated.invoice.id, STAFF_1.id);

		expect(await resendInvoice(generated.invoice.id, '   ', STAFF_1.id)).toEqual({
			ok: false,
			reason: 'invalid-input'
		});
	});

	it('never resends a generated or skipped invoice', async () => {
		const appointment = await createAppointment({
			patientId: patientActivoId,
			startsAt: pastDate()
		});
		await addService(appointment, consultaId, 1, STAFF_1.id);
		const generated = await generateInvoice(appointment, STAFF_1.id);
		if (!generated.ok) {
			expect.unreachable();
			return;
		}

		// A skipped invoice stays 'generated': resending is not allowed yet.
		await markSkipped(generated.invoice.id, STAFF_1.id);
		expect(await resendInvoice(generated.invoice.id, 'Corrección', STAFF_1.id)).toEqual({
			ok: false,
			reason: 'cannot-resend-generated'
		});

		expect(await resendInvoice('no-existe', 'Corrección', STAFF_1.id)).toEqual({
			ok: false,
			reason: 'not-found'
		});
	});

	it('creates a fresh snapshot with the current catalog and links it to the original', async () => {
		const appointment = await createAppointment({
			patientId: patientActivoId,
			startsAt: pastDate()
		});
		await addService(appointment, empasteId, 1, STAFF_1.id);
		const first = await generateInvoice(appointment, STAFF_1.id);
		if (!first.ok) {
			expect.unreachable();
			return;
		}
		await markSent(first.invoice.id, STAFF_1.id);
		await tick();

		// Price changes between original and resend: only the new snapshot moves.
		await db.update(servicePrices).set({ price: 30000 }).where(eq(servicePrices.id, empasteId));

		const resent = await resendInvoice(
			first.invoice.id,
			'El número registrado estaba mal',
			STAFF_2.id
		);
		expect(resent.ok).toBe(true);
		if (!resent.ok) {
			await db.update(servicePrices).set({ price: 25000 }).where(eq(servicePrices.id, empasteId));
			return;
		}

		expect(resent.invoice.status).toBe('resent');
		expect(resent.invoice.resentReason).toBe('El número registrado estaba mal');
		expect(resent.invoice.resentOf).toBe(first.invoice.id);
		expect(resent.invoice.total).toBe(30000);
		expect(resent.invoice.id).not.toBe(first.invoice.id);

		const [original] = await db
			.select()
			.from(invoiceHistory)
			.where(eq(invoiceHistory.id, first.invoice.id));
		expect(original?.status).toBe('sent');
		expect(original?.total).toBe(25000);
		expect(original?.resentReason).toBeNull();

		// Resending without confirming delivery records nothing; the reminder row
		// appears only when markSent confirms the new snapshot was delivered.
		const records = await db
			.select()
			.from(reminderRecords)
			.where(eq(reminderRecords.appointmentId, appointment));
		expect(records).toHaveLength(1);
		expect(records[0]?.status).toBe('sent');

		await db.update(servicePrices).set({ price: 25000 }).where(eq(servicePrices.id, empasteId));
	});
});

describe('invoice listings', () => {
	it('lists newest first with the staff that recorded each', async () => {
		const appointment = await createAppointment({
			patientId: patientActivoId,
			startsAt: pastDate()
		});
		await addService(appointment, consultaId, 1, STAFF_1.id);
		const first = await generateInvoice(appointment, STAFF_1.id);
		await tick();
		const second = await generateInvoice(appointment, STAFF_2.id);
		if (!first.ok || !second.ok) {
			expect.unreachable();
			return;
		}

		const byAppointment = await listInvoicesByAppointment(appointment);
		expect(byAppointment).toHaveLength(2);
		expect(byAppointment[0]?.id).toBe(second.invoice.id);
		expect(byAppointment[0]?.createdByName).toBe(STAFF_2.name);
		expect(byAppointment[1]?.createdByName).toBe(STAFF_1.name);

		const byPatient = await listInvoicesByPatient(patientActivoId);
		expect(byPatient.length).toBeGreaterThanOrEqual(2);
		expect(byPatient[0]?.patientName).toBe('Ana Prácticas');
	});
});

describe('buildInvoiceMessage', () => {
	let data: InvoiceData;

	beforeAll(() => {
		process.env.CLINIC_NAME = 'Consultorio de prueba';
		process.env.CLINIC_PHONE = '+54 9 11 5555-9999';
		process.env.CLINIC_ADDRESS = 'Calle de Prueba 1';

		data = {
			appointment: {
				id: 'appt-1',
				summary: null,
				// 02:19 UTC = 23:19 del día anterior en Buenos Aires.
				startsAt: new Date('2026-03-10T02:19:00Z')
			},
			patient: {
				id: 'pat-1',
				name: 'Ana',
				phone: '+5491155550101',
				whatsappConsent: 'granted',
				optedOutAt: null
			},
			services: [
				{ serviceType: 'consulta', name: 'Consulta', price: 15000, quantity: 1, subtotal: 15000 },
				{
					serviceType: 'empaste',
					name: 'Empaste simple',
					price: 25000,
					quantity: 2,
					subtotal: 50000
				}
			],
			subtotal: 65000,
			total: 65000
		};
	});

	it('renders service lines, es-AR money and quantities', () => {
		const result = buildInvoiceMessage(data);
		if (!result.ok) return expect.unreachable();
		const { message } = result;

		expect(message).toContain('• Consulta — $15.000');
		expect(message).toContain('• 2 × Empaste simple ($25.000 c/u) — $50.000');
		expect(message).toContain('Total: $65.000');
		// es-AR thousands separator, never cents or plain commas.
		expect(message).not.toContain('$15,000');
	});

	it('formats the date in the practice timezone, not UTC', () => {
		const result = buildInvoiceMessage(data);
		if (!result.ok) return expect.unreachable();
		expect(result.message).toContain('lunes, 9 de marzo');
		expect(result.message).toContain('23:19');
		expect(result.message).not.toContain('02:19');
	});

	it('interpolates the patient name and clinic contact block', () => {
		const result = buildInvoiceMessage(data);
		if (!result.ok) return expect.unreachable();
		expect(result.message).toContain('Hola Ana');
		expect(result.message).toContain('Consultorio de prueba');
		expect(result.message).toContain('Calle de Prueba 1');
		expect(result.message).toContain('Tel: +54 9 11 5555-9999');
	});

	it('never returns a message with leftover placeholders or blank text', () => {
		const result = buildInvoiceMessage(data);
		if (!result.ok) return expect.unreachable();
		expect(result.message.trim()).not.toBe('');
		expect(result.message.includes('{{')).toBe(false);
	});

	it('reports empty-message instead of sending a broken render', () => {
		// A patient name that itself contains a placeholder leaves one in the
		// render; the invoice service must refuse it.
		const contaminated: InvoiceData = {
			...data,
			patient: { ...data.patient, name: 'Ana{{prueba}}' }
		};
		expect(buildInvoiceMessage(contaminated)).toEqual({
			ok: false,
			reason: 'empty-message'
		});
	});
});
