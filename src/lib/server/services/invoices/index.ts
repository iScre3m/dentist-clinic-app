import { randomUUID } from 'node:crypto';
import { db } from '#lib/server/db/index.ts';
import {
	appointmentServices,
	appointments,
	invoiceHistory,
	patients,
	reminderRecords,
	servicePrices,
	user
} from '#lib/server/db/schema.ts';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { InvoiceHistory } from '#lib/server/db/schema.ts';
import { renderTemplate } from '#lib/server/services/whatsapp/index.ts';
import { getClinicInfo } from '#lib/server/clinic.ts';

const MAX_QUANTITY = 99;

export type RemoveServiceResult = { ok: true } | { ok: false; reason: 'not-found' };

export type SetQuantityResult = { ok: true } | { ok: false; reason: 'not-found' | 'invalid-input' };

export type AddServiceResult =
	| { ok: true; appointmentServiceId: string; quantity: number }
	| {
			ok: false;
			reason:
				| 'appointment-not-found'
				| 'no-patient'
				| 'patient-archived'
				| 'service-not-found'
				| 'limit-reached'
				| 'invalid-input';
	  };

export type AppointmentServiceRow = {
	id: string;
	servicePriceId: string;
	serviceType: string;
	name: string;
	price: number;
	/** Price exists in the catalog; false only for orphaned references (diagnostics). */
	priceMissing: boolean;
	quantity: number;
};

/** Appointment services joined with the current catalog price, display order. */
export async function listAppointmentServices(
	appointmentId: string
): Promise<AppointmentServiceRow[]> {
	const rows = await db
		.select({
			id: appointmentServices.id,
			servicePriceId: appointmentServices.servicePriceId,
			serviceType: servicePrices.serviceType,
			name: servicePrices.name,
			price: servicePrices.price,
			quantity: appointmentServices.quantity
		})
		.from(appointmentServices)
		.leftJoin(servicePrices, eq(appointmentServices.servicePriceId, servicePrices.id))
		.where(eq(appointmentServices.appointmentId, appointmentId))
		.orderBy(asc(servicePrices.name));

	return rows.map((row) => ({
		id: row.id,
		servicePriceId: row.servicePriceId,
		serviceType: row.serviceType ?? '',
		name: row.name ?? row.serviceType ?? '',
		price: row.price ?? 0,
		priceMissing: row.price === null,
		quantity: row.quantity
	}));
}

/**
 * Shared guard: services may only be recorded on appointments linked to an
 * existing, non-archived patient (Requirement 2.4).
 */
async function loadAppointmentForService(appointmentId: string) {
	const [row] = await db
		.select({
			id: appointments.id,
			patientId: appointments.patientId,
			archivedAt: patients.archivedAt
		})
		.from(appointments)
		.leftJoin(patients, eq(appointments.patientId, patients.id))
		.where(eq(appointments.id, appointmentId))
		.limit(1);
	return row ?? null;
}

/**
 * Add a service to an appointment. The unique pair
 * (appointment_id, service_price_id) means selecting an already-added type
 * accumulates quantity (capped at 99) instead of creating a duplicate row.
 */
export async function addService(
	appointmentId: string,
	servicePriceId: string,
	quantity: number,
	staffId: string
): Promise<AddServiceResult> {
	if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
		return { ok: false, reason: 'invalid-input' };
	}

	const appointment = await loadAppointmentForService(appointmentId);
	if (!appointment) return { ok: false, reason: 'appointment-not-found' };
	if (!appointment.patientId) return { ok: false, reason: 'no-patient' };
	if (appointment.archivedAt) return { ok: false, reason: 'patient-archived' };

	const [priceRow] = await db
		.select({ id: servicePrices.id })
		.from(servicePrices)
		.where(eq(servicePrices.id, servicePriceId))
		.limit(1);
	if (!priceRow) return { ok: false, reason: 'service-not-found' };

	const [existing] = await db
		.select({
			id: appointmentServices.id,
			quantity: appointmentServices.quantity
		})
		.from(appointmentServices)
		.where(
			and(
				eq(appointmentServices.appointmentId, appointmentId),
				eq(appointmentServices.servicePriceId, servicePriceId)
			)
		)
		.limit(1);

	const now = new Date();

	if (existing) {
		const total = existing.quantity + quantity;
		if (total > MAX_QUANTITY) return { ok: false, reason: 'limit-reached' };

		await db
			.update(appointmentServices)
			.set({ quantity: total, updatedAt: now })
			.where(eq(appointmentServices.id, existing.id));
		return { ok: true, appointmentServiceId: existing.id, quantity: total };
	}

	const id = randomUUID();
	await db.insert(appointmentServices).values({
		id,
		appointmentId,
		servicePriceId,
		quantity,
		addedBy: staffId,
		createdAt: now,
		updatedAt: now
	});
	return { ok: true, appointmentServiceId: id, quantity };
}

/** Delete a recorded service. Nothing about the removal is logged. */
export async function removeService(appointmentServiceId: string): Promise<RemoveServiceResult> {
	const deleted = await db
		.delete(appointmentServices)
		.where(eq(appointmentServices.id, appointmentServiceId))
		.returning({ id: appointmentServices.id });

	if (deleted.length === 0) return { ok: false, reason: 'not-found' };
	return { ok: true };
}

/** Edit the quantity of a recorded service. */
export async function setQuantity(
	appointmentServiceId: string,
	quantity: number
): Promise<SetQuantityResult> {
	if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
		return { ok: false, reason: 'invalid-input' };
	}

	const updated = await db
		.update(appointmentServices)
		.set({ quantity, updatedAt: new Date() })
		.where(eq(appointmentServices.id, appointmentServiceId))
		.returning({ id: appointmentServices.id });

	if (updated.length === 0) return { ok: false, reason: 'not-found' };
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Invoice generation (Requirement 3)
// ---------------------------------------------------------------------------

export type InvoiceGuard =
	| 'appointment-not-found'
	| 'cancelled'
	| 'future'
	| 'all-day'
	| 'no-patient'
	| 'patient-archived'
	| 'no-services'
	| 'missing-prices';

export type InvoiceServiceSnapshot = {
	serviceType: string;
	name: string;
	price: number;
	quantity: number;
	subtotal: number;
};

export type InvoicePatient = {
	id: string;
	name: string;
	phone: string;
	whatsappConsent: 'granted' | 'denied';
	optedOutAt: Date | null;
};

export type InvoiceData = {
	appointment: {
		id: string;
		summary: string | null;
		startsAt: Date;
	};
	patient: InvoicePatient;
	/** Prices current at the moment of reading — the generation snapshot. */
	services: InvoiceServiceSnapshot[];
	subtotal: number;
	total: number;
};

export type GetInvoiceDataResult =
	{ ok: true; data: InvoiceData } | { ok: false; reason: InvoiceGuard; missingPriceIds?: string[] };

export type GenerateInvoiceResult =
	| { ok: true; invoice: InvoiceHistory; data: InvoiceData }
	| { ok: false; reason: InvoiceGuard; missingPriceIds?: string[] };

/**
 * Runs the complete invoice guard chain (Requirement 3) and returns the
 * invoice data priced at this moment:
 * appointment exists + calendar-confirmed + in the past + timed;
 * linked, non-archived patient; at least one recorded service; every service priced.
 */
async function loadInvoiceContext(appointmentId: string): Promise<GetInvoiceDataResult> {
	const [appointment] = await db
		.select({
			id: appointments.id,
			summary: appointments.summary,
			startsAt: appointments.startsAt,
			allDay: appointments.allDay,
			calendarStatus: appointments.calendarStatus,
			attendanceStatus: appointments.attendanceStatus
		})
		.from(appointments)
		.where(eq(appointments.id, appointmentId))
		.limit(1);

	if (!appointment) return { ok: false, reason: 'appointment-not-found' };
	if (appointment.calendarStatus !== 'confirmed') return { ok: false, reason: 'cancelled' };
	if (!appointment.startsAt) return { ok: false, reason: 'all-day' };
	if (new Date(appointment.startsAt).getTime() >= Date.now() && appointment.attendanceStatus !== 'attended')
		return { ok: false, reason: 'future' };

	const [patient] = await db
		.select({
			id: patients.id,
			name: patients.name,
			phone: patients.phone,
			whatsappConsent: patients.whatsappConsent,
			optedOutAt: patients.optedOutAt,
			archivedAt: patients.archivedAt
		})
		.from(patients)
		.innerJoin(appointments, eq(appointments.patientId, patients.id))
		.where(eq(appointments.id, appointmentId))
		.limit(1);

	if (!patient) return { ok: false, reason: 'no-patient' };
	if (patient.archivedAt) return { ok: false, reason: 'patient-archived' };

	const rows = await db
		.select({
			serviceType: servicePrices.serviceType,
			name: servicePrices.name,
			price: servicePrices.price,
			quantity: appointmentServices.quantity,
			servicePriceId: appointmentServices.servicePriceId
		})
		.from(appointmentServices)
		.leftJoin(servicePrices, eq(appointmentServices.servicePriceId, servicePrices.id))
		.where(eq(appointmentServices.appointmentId, appointmentId))
		.orderBy(asc(servicePrices.name));

	if (rows.length === 0) return { ok: false, reason: 'no-services' };

	const unpriced = rows.filter((row) => row.price === null);
	if (unpriced.length > 0)
		return {
			ok: false,
			reason: 'missing-prices',
			missingPriceIds: unpriced.map((row) => row.servicePriceId)
		};

	const services = rows.map((row) => ({
		serviceType: row.serviceType as string,
		name: row.name as string,
		price: row.price as number,
		quantity: row.quantity,
		subtotal: (row.price as number) * row.quantity
	}));
	const total = services.reduce((sum, s) => sum + s.subtotal, 0);

	return {
		ok: true,
		data: {
			appointment: {
				id: appointment.id,
				summary: appointment.summary,
				startsAt: new Date(appointment.startsAt)
			},
			patient: {
				id: patient.id,
				name: patient.name,
				phone: patient.phone,
				whatsappConsent: patient.whatsappConsent,
				optedOutAt: patient.optedOutAt
			},
			services,
			subtotal: total,
			total
		}
	};
}

/** Guard chain + preview priced right now. Used by the page load for display. */
export async function getInvoiceData(appointmentId: string): Promise<GetInvoiceDataResult> {
	return loadInvoiceContext(appointmentId);
}

export type ConfirmDeliveryResult =
	{ ok: true } | { ok: false; reason: 'not-found' | 'already-sent' };

export type ResendResult =
	| { ok: true; invoice: InvoiceHistory }
	| { ok: false; reason: 'not-found' | 'cannot-resend-generated' | 'invalid-input' | InvoiceGuard };

/** Invoices for one patient, newest first (patient detail page). */
export async function listInvoicesByPatient(patientId: string, limit = 20) {
	return db
		.select({
			id: invoiceHistory.id,
			appointmentId: invoiceHistory.appointmentId,
			patientName: invoiceHistory.patientName,
			patientPhone: invoiceHistory.patientPhone,
			appointmentStartsAt: invoiceHistory.appointmentStartsAt,
			subtotal: invoiceHistory.subtotal,
			total: invoiceHistory.total,
			status: invoiceHistory.status,
			sentAt: invoiceHistory.sentAt,
			resentReason: invoiceHistory.resentReason,
			createdBy: invoiceHistory.createdBy,
			createdByName: user.name,
			createdAt: invoiceHistory.createdAt
		})
		.from(invoiceHistory)
		.leftJoin(user, eq(invoiceHistory.createdBy, user.id))
		.where(eq(invoiceHistory.patientId, patientId))
		.orderBy(desc(invoiceHistory.createdAt))
		.limit(limit);
}

/** Invoice snapshots for one appointment, newest first (appointment invoice page). */
export async function listInvoicesByAppointment(appointmentId: string, limit = 20) {
	return db
		.select({
			id: invoiceHistory.id,
			appointmentId: invoiceHistory.appointmentId,
			patientName: invoiceHistory.patientName,
			patientPhone: invoiceHistory.patientPhone,
			appointmentStartsAt: invoiceHistory.appointmentStartsAt,
			subtotal: invoiceHistory.subtotal,
			total: invoiceHistory.total,
			status: invoiceHistory.status,
			sentAt: invoiceHistory.sentAt,
			resentReason: invoiceHistory.resentReason,
			resentOf: invoiceHistory.resentOf,
			createdBy: invoiceHistory.createdBy,
			createdByName: user.name,
			createdAt: invoiceHistory.createdAt
		})
		.from(invoiceHistory)
		.leftJoin(user, eq(invoiceHistory.createdBy, user.id))
		.where(eq(invoiceHistory.appointmentId, appointmentId))
		.orderBy(desc(invoiceHistory.createdAt))
		.limit(limit);
}

/**
 * Record the staff's confirmation that the invoice was delivered. This is what
 * flips the status and creates the `reminder_records` row (purpose 'invoice')
 * — never generation or rendering. Both writes run in one sync transaction.
 */
export async function markSent(invoiceId: string, staffId: string): Promise<ConfirmDeliveryResult> {
	const [invoice] = await db
		.select({
			id: invoiceHistory.id,
			appointmentId: invoiceHistory.appointmentId,
			status: invoiceHistory.status,
			sentAt: invoiceHistory.sentAt
		})
		.from(invoiceHistory)
		.where(eq(invoiceHistory.id, invoiceId))
		.limit(1);

	if (!invoice) return { ok: false, reason: 'not-found' };
	if (invoice.status === 'sent') return { ok: false, reason: 'already-sent' };

	const now = new Date();

	return db.transaction((tx) => {
		// A resent invoice keeps its 'resent' status; the send timestamp is set here.
		const update = tx
			.update(invoiceHistory)
			.set({ status: invoice.status === 'resent' ? 'resent' : 'sent', sentAt: now })
			.where(eq(invoiceHistory.id, invoiceId))
			.returning({ id: invoiceHistory.id })
			.all();

		if (update.length === 0) return { ok: false, reason: 'not-found' as const };

		tx.insert(reminderRecords)
			.values({
				id: randomUUID(),
				appointmentId: invoice.appointmentId,
				purpose: 'invoice',
				templateKey: 'invoice',
				status: 'sent',
				recordedBy: staffId,
				recordedAt: now,
				createdAt: now,
				updatedAt: now
			})
			.returning({ id: reminderRecords.id })
			.all();

		return { ok: true } as const;
	});
}

/** Record that the assistant chose not to send. The invoice stays 'generated'. */
export async function markSkipped(
	invoiceId: string,
	staffId: string
): Promise<ConfirmDeliveryResult> {
	const [invoice] = await db
		.select({
			id: invoiceHistory.id,
			appointmentId: invoiceHistory.appointmentId,
			status: invoiceHistory.status
		})
		.from(invoiceHistory)
		.where(eq(invoiceHistory.id, invoiceId))
		.limit(1);

	if (!invoice) return { ok: false, reason: 'not-found' };

	const now = new Date();
	await db.insert(reminderRecords).values({
		id: randomUUID(),
		appointmentId: invoice.appointmentId,
		purpose: 'invoice',
		templateKey: 'invoice',
		status: 'skipped',
		recordedBy: staffId,
		recordedAt: now,
		createdAt: now,
		updatedAt: now
	});
	return { ok: true };
}

/**
 * Intentional resend: fresh snapshot of current prices (they may have changed),
 * status 'resent', written reason, reference to the original. The reminder
 * record for the resend is created when delivery is confirmed with markSent.
 */
export async function resendInvoice(
	originalInvoiceId: string,
	reason: string,
	staffId: string
): Promise<ResendResult> {
	const trimmed = reason.trim();
	if (trimmed.length < 1 || trimmed.length > 200) return { ok: false, reason: 'invalid-input' };

	const [original] = await db
		.select({
			id: invoiceHistory.id,
			appointmentId: invoiceHistory.appointmentId,
			status: invoiceHistory.status
		})
		.from(invoiceHistory)
		.where(eq(invoiceHistory.id, originalInvoiceId))
		.limit(1);

	if (!original) return { ok: false, reason: 'not-found' };
	if (original.status === 'generated') {
		return { ok: false, reason: 'cannot-resend-generated' };
	}

	const generated = await generateInvoice(original.appointmentId, staffId);
	if (!generated.ok) return generated;

	const [resent] = await db
		.update(invoiceHistory)
		.set({ status: 'resent', resentReason: trimmed, resentOf: original.id })
		.where(eq(invoiceHistory.id, generated.invoice.id))
		.returning();

	return { ok: true, invoice: resent! };
}

// ---------------------------------------------------------------------------
// WhatsApp message rendering (Requirement 4)
// ---------------------------------------------------------------------------

const arsFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

const fechaFormat = new Intl.DateTimeFormat('es-AR', {
	timeZone: 'America/Argentina/Buenos_Aires',
	weekday: 'long',
	day: 'numeric',
	month: 'long',
	hour: 'numeric',
	minute: '2-digit',
	hourCycle: 'h23'
});

function formatServiceLine(item: InvoiceServiceSnapshot): string {
	if (item.quantity === 1) {
		return '• ' + item.name + ' — $' + arsFormat.format(item.subtotal);
	}
	return (
		'• ' +
		item.quantity +
		' × ' +
		item.name +
		' ($' +
		arsFormat.format(item.price) +
		' c/u) — $' +
		arsFormat.format(item.subtotal)
	);
}

/**
 * Renders the WhatsApp message from the `invoice` template: the variable-length
 * service list is interpolated into `{{servicios}}` (a flat template cannot
 * hold a list) and the clinic identity comes from `getClinicInfo()`.
 *
 * Fallback for an empty render (missing or degenerate template): report an
 * error instead of handing staff an empty message to send.
 */
export function buildInvoiceMessage(
	data: InvoiceData
): { ok: true; message: string } | { ok: false; reason: 'empty-message' } {
	const clinic = getClinicInfo();
	const message = renderTemplate('invoice', {
		nombre: data.patient.name,
		fecha: fechaFormat.format(data.appointment.startsAt),
		consultorio: clinic.name,
		servicios: data.services.map(formatServiceLine).join('\n'),
		total: arsFormat.format(data.total),
		contacto_consultorio: [clinic.name, clinic.address, 'Tel: ' + clinic.phone].join('\n')
	});

	if (message.trim() === '' || message.includes('{{')) {
		return { ok: false, reason: 'empty-message' };
	}
	return { ok: true, message };
}

/**
 * Generate an invoice snapshot: re-runs the guards, then inserts the itemized
 * prices current at generation time. Regenerating is allowed; the new snapshot
 * is a separate row (see design: newest-first list).
 *
 * Note: better-sqlite3 transactions cannot wrap async callbacks, and the only
 * write here is a single atomic INSERT, so no explicit transaction is used —
 * the guards run immediately before it (single staff user, MVP scope).
 */
export async function generateInvoice(
	appointmentId: string,
	staffId: string
): Promise<GenerateInvoiceResult> {
	const context = await loadInvoiceContext(appointmentId);
	if (!context.ok) return context;

	const { data } = context;
	const now = new Date();
	const invoice = await db
		.insert(invoiceHistory)
		.values({
			id: randomUUID(),
			appointmentId: data.appointment.id,
			patientId: data.patient.id,
			patientName: data.patient.name,
			patientPhone: data.patient.phone,
			appointmentStartsAt: data.appointment.startsAt,
			services: data.services,
			subtotal: data.subtotal,
			total: data.total,
			createdBy: staffId,
			status: 'generated',
			createdAt: now
		})
		.returning();

	return { ok: true, invoice: invoice[0]!, data };
}
