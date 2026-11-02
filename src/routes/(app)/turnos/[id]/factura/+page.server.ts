import { error, fail } from '@sveltejs/kit';
import { requireUser } from '#lib/server/session.ts';
import { db } from '#lib/server/db/index.ts';
import { appointments, patients } from '#lib/server/db/schema.ts';
import { eq } from 'drizzle-orm';
import {
	addService,
	buildInvoiceMessage,
	generateInvoice,
	getInvoiceData,
	listAppointmentServices,
	listInvoicesByAppointment,
	markSent,
	markSkipped,
	removeService,
	resendInvoice,
	setQuantity
} from '#lib/server/services/invoices/index.ts';
import { listActiveServicePrices } from '#lib/server/services/pricing/index.ts';
import { buildWaMeLink } from '#lib/server/services/whatsapp/index.ts';
import * as v from 'valibot';
import {
	addAppointmentServiceSchema,
	generateInvoiceSchema,
	confirmInvoiceDeliverySchema,
	removeAppointmentServiceSchema,
	resendInvoiceSchema,
	setAppointmentServiceQuantitySchema
} from '#lib/schemas/invoice.schema.ts';
import type { Actions, PageServerLoad } from './$types';

function guardMessage(reason: string): string {
	switch (reason) {
		case 'appointment-not-found':
			return 'No encontramos ese turno.';
		case 'cancelled':
			return 'Este turno fue cancelado o borrado del calendario.';
		case 'future':
			return 'Las facturas se emiten después del turno.';
		case 'all-day':
			return 'No se puede facturar un turno de todo el día.';
		case 'no-patient':
			return 'Este turno no tiene un paciente vinculado.';
		case 'patient-archived':
			return 'El paciente está archivado.';
		case 'no-services':
			return 'Todavía no cargaste prácticas para este turno.';
		case 'missing-prices':
			return 'Hay prácticas sin precio. Cargá el precio en Prácticas.';
		default:
			return 'No se puede generar la factura.';
	}
}

export const load: PageServerLoad = async ({ locals, params }) => {
	requireUser(locals);
	const { id } = params;

	const [appointment] = await db
		.select({
			id: appointments.id,
			summary: appointments.summary,
			startsAt: appointments.startsAt,
			endsAt: appointments.endsAt,
			allDay: appointments.allDay,
			calendarStatus: appointments.calendarStatus,
			patientId: appointments.patientId,
			patientName: patients.name,
			patientPhone: patients.phone,
			patientConsent: patients.whatsappConsent,
			patientOptedOutAt: patients.optedOutAt
		})
		.from(appointments)
		.leftJoin(patients, eq(appointments.patientId, patients.id))
		.where(eq(appointments.id, id))
		.limit(1);

	if (!appointment) throw error(404, 'No encontramos ese turno.');

	const [services, activePrices, invoiceContext, invoices] = await Promise.all([
		listAppointmentServices(id),
		listActiveServicePrices(),
		getInvoiceData(id),
		listInvoicesByAppointment(id)
	]);

	let message: string | null = null;
	let waMeLink: string | null = null;
	const consentOk =
		!!appointment.patientId &&
		appointment.patientConsent === 'granted' &&
		!appointment.patientOptedOutAt &&
		!!appointment.patientPhone;

	if (invoiceContext.ok && consentOk) {
		const built = buildInvoiceMessage(invoiceContext.data);
		if (built.ok) {
			message = built.message;
			waMeLink = buildWaMeLink(appointment.patientPhone!, built.message);
		}
	}

	const blockedReason = invoiceContext.ok ? null : invoiceContext.reason;

	return {
		appointment,
		services,
		activePrices,
		invoiceData: invoiceContext.ok ? invoiceContext.data : null,
		blockedReason,
		blockedMessage: blockedReason ? guardMessage(blockedReason) : null,
		missingPriceIds: invoiceContext.ok ? undefined : invoiceContext.missingPriceIds,
		invoices,
		message,
		waMeLink,
		consentOk
	};
};

export const actions: Actions = {
	add_service: async ({ locals, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const parsed = v.safeParse(addAppointmentServiceSchema, {
			appointmentId: form.get('appointmentId')?.toString() ?? '',
			servicePriceId: form.get('servicePriceId')?.toString() ?? '',
			quantity: Number(form.get('quantity')?.toString() ?? 1)
		});
		if (!parsed.success) {
			return fail(400, {
				action: 'add_service',
				success: false,
				error: parsed.issues[0]?.message ?? 'Revisá los datos.'
			});
		}
		const result = await addService(
			parsed.output.appointmentId,
			parsed.output.servicePriceId,
			parsed.output.quantity,
			user.id
		);
		if (!result.ok) {
			return fail(400, {
				action: 'add_service',
				success: false,
				error: 'No se pudo agregar la práctica.'
			});
		}
		return { action: 'add_service', success: true };
	},
	remove_service: async ({ locals, request }) => {
		requireUser(locals);
		const form = await request.formData();
		const parsed = v.safeParse(removeAppointmentServiceSchema, {
			appointmentServiceId: form.get('appointmentServiceId')?.toString() ?? ''
		});
		if (!parsed.success) {
			return fail(400, {
				action: 'remove_service',
				success: false,
				error: 'Identificador inválido.'
			});
		}
		const result = await removeService(parsed.output.appointmentServiceId);
		if (!result.ok) {
			return fail(400, {
				action: 'remove_service',
				success: false,
				error: 'No se encontró la práctica.'
			});
		}
		return { action: 'remove_service', success: true };
	},
	set_quantity: async ({ locals, request }) => {
		requireUser(locals);
		const form = await request.formData();
		const parsed = v.safeParse(setAppointmentServiceQuantitySchema, {
			appointmentServiceId: form.get('appointmentServiceId')?.toString() ?? '',
			quantity: Number(form.get('quantity')?.toString() ?? 1)
		});
		if (!parsed.success) {
			return fail(400, {
				action: 'set_quantity',
				success: false,
				error: parsed.issues[0]?.message ?? 'Revisá la cantidad.'
			});
		}
		const result = await setQuantity(parsed.output.appointmentServiceId, parsed.output.quantity);
		if (!result.ok) {
			return fail(400, {
				action: 'set_quantity',
				success: false,
				error: 'No se pudo actualizar la cantidad.'
			});
		}
		return { action: 'set_quantity', success: true };
	},
	generate: async ({ locals, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const parsed = v.safeParse(generateInvoiceSchema, {
			appointmentId: form.get('appointmentId')?.toString() ?? ''
		});
		if (!parsed.success) {
			return fail(400, { action: 'generate', success: false, error: 'Identificador inválido.' });
		}
		const result = await generateInvoice(parsed.output.appointmentId, user.id);
		if (!result.ok) {
			return fail(400, { action: 'generate', success: false, error: guardMessage(result.reason) });
		}
		return { action: 'generate', success: true, invoiceId: result.invoice.id };
	},
	mark_sent: async ({ locals, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const parsed = v.safeParse(confirmInvoiceDeliverySchema, {
			invoiceId: form.get('invoiceId')?.toString() ?? '',
			action: 'sent'
		});
		if (!parsed.success) {
			return fail(400, { action: 'mark_sent', success: false, error: 'Identificador inválido.' });
		}
		const result = await markSent(parsed.output.invoiceId, user.id);
		if (!result.ok) {
			return fail(400, {
				action: 'mark_sent',
				success: false,
				error: 'No se pudo registrar el envío.'
			});
		}
		return { action: 'mark_sent', success: true };
	},
	mark_skipped: async ({ locals, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const parsed = v.safeParse(confirmInvoiceDeliverySchema, {
			invoiceId: form.get('invoiceId')?.toString() ?? '',
			action: 'skipped'
		});
		if (!parsed.success) {
			return fail(400, {
				action: 'mark_skipped',
				success: false,
				error: 'Identificador inválido.'
			});
		}
		const result = await markSkipped(parsed.output.invoiceId, user.id);
		if (!result.ok) {
			return fail(400, { action: 'mark_skipped', success: false, error: 'No se pudo registrar.' });
		}
		return { action: 'mark_skipped', success: true };
	},
	resend: async ({ locals, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const parsed = v.safeParse(resendInvoiceSchema, {
			invoiceId: form.get('invoiceId')?.toString() ?? '',
			reason: form.get('reason')?.toString() ?? ''
		});
		if (!parsed.success) {
			return fail(400, {
				action: 'resend',
				success: false,
				error: parsed.issues[0]?.message ?? 'Motivo requerido.'
			});
		}
		const result = await resendInvoice(parsed.output.invoiceId, parsed.output.reason, user.id);
		if (!result.ok) {
			return fail(400, {
				action: 'resend',
				success: false,
				error: 'No se pudo reenviar la factura.'
			});
		}
		return { action: 'resend', success: true, invoiceId: result.invoice.id };
	}
};
