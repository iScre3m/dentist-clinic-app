import { error, redirect } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { requireUser } from '#lib/server/session.ts';
import { db } from '#lib/server/db/index.ts';
import { appointments, patients, reminderRecords } from '#lib/server/db/schema.ts';
import { renderTemplate, buildWaMeLink } from '#lib/server/services/whatsapp/index.ts';
import * as v from 'valibot';
import { and, desc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const resendSchema = v.object({
	resent_reason: v.pipe(v.string(), v.trim(), v.minLength(1, 'Escribí un motivo para el reenvío.'))
});

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = requireUser(locals);
	const { id } = params;

	const rows = await db
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

	const appointment = rows[0];
	if (!appointment) {
		throw error(404, 'No encontramos ese turno.');
	}

	const now = new Date();
	const isFuture =
		appointment.startsAt && new Date(appointment.startsAt) > now
			? true
			: appointment.allDay && appointment.startsAt
				? new Date(appointment.startsAt).setHours(0, 0, 0, 0) >= now.setHours(0, 0, 0, 0)
				: false;

	if (!isFuture) {
		throw error(400, 'Solo se pueden enviar recordatorios para turnos futuros.');
	}
	if (appointment.calendarStatus !== 'confirmed') {
		throw error(400, 'Este turno fue cancelado o borrado del calendario.');
	}
	if (!appointment.patientId) {
		throw error(400, 'Este turno no tiene un paciente vinculado.');
	}
	if (appointment.patientConsent !== 'granted') {
		throw error(400, 'El paciente no dio consentimiento para recibir recordatorios por WhatsApp.');
	}
	if (!appointment.patientPhone) {
		throw error(400, 'El paciente no tiene un número de WhatsApp válido.');
	}
	if (appointment.patientOptedOutAt) {
		throw error(400, 'El paciente pidió no recibir mensajes de WhatsApp.');
	}

	const startsAt = new Date(appointment.startsAt!);

	const fecha = new Intl.DateTimeFormat('es-AR', {
		timeZone: 'America/Argentina/Buenos_Aires',
		weekday: 'long',
		day: 'numeric',
		month: 'long'
	}).format(startsAt);

	const hora = new Intl.DateTimeFormat('es-AR', {
		timeZone: 'America/Argentina/Buenos_Aires',
		hour: '2-digit',
		minute: '2-digit'
	}).format(startsAt);

	const message = renderTemplate('initial', {
		nombre: appointment.patientName ?? '',
		fecha,
		hora,
		consultorio: 'Consultorio Dra. Laura',
		nombre_odontologa: 'Dra. Laura',
		telefono_consultorio: '+54 9 11 1111 1111'
	});

	const waMeLink = buildWaMeLink(appointment.patientPhone, message);

	const existing = await db
		.select()
		.from(reminderRecords)
		.where(and(eq(reminderRecords.appointmentId, id), eq(reminderRecords.purpose, 'reminder')))
		.orderBy(desc(reminderRecords.recordedAt))
		.limit(1);

	let reminderRecord = existing[0];
	if (!reminderRecord || reminderRecord.status !== 'prepared') {
		const [created] = await db
			.insert(reminderRecords)
			.values({
				id: randomUUID(),
				appointmentId: id,
				purpose: 'reminder',
				templateKey: 'initial',
				status: 'prepared',
				recordedBy: user.id,
				recordedAt: now,
				updatedAt: now
			})
			.returning();
		reminderRecord = created;
	}

	const canResend = existing.some((r) => r.status === 'sent');

	return {
		appointment: {
			id: appointment.id,
			summary: appointment.summary,
			startsAt: appointment.startsAt,
			allDay: appointment.allDay,
			patientName: appointment.patientName,
			patientPhone: appointment.patientPhone
		},
		message,
		waMeLink,
		templateKey: 'initial',
		reminderRecord: {
			id: reminderRecord.id,
			status: reminderRecord.status,
			templateKey: reminderRecord.templateKey,
			recordedAt: reminderRecord.recordedAt,
			resentReason: reminderRecord.resentReason
		},
		canResend
	};
};

export const actions: Actions = {
	marcarEnviado: async ({ locals, request }) => {
		const user = requireUser(locals);
		const formData = await request.formData();
		const appointmentId = formData.get('appointmentId')?.toString();
		if (!appointmentId) return { success: false, error: 'Faltan datos.' };

		const record = await db
			.select()
			.from(reminderRecords)
			.where(
				and(
					eq(reminderRecords.appointmentId, appointmentId),
					eq(reminderRecords.status, 'prepared')
				)
			)
			.orderBy(desc(reminderRecords.createdAt))
			.limit(1);

		const now = new Date();
		let row;
		if (record.length === 0) {
			[row] = await db
				.insert(reminderRecords)
				.values({
					id: randomUUID(),
					appointmentId,
					purpose: 'reminder',
					templateKey: 'initial',
					status: 'sent',
					recordedBy: user.id,
					recordedAt: now,
					updatedAt: now
				})
				.returning();
		} else {
			[row] = await db
				.update(reminderRecords)
				.set({ status: 'sent', recordedBy: user.id, recordedAt: now, updatedAt: now })
				.where(eq(reminderRecords.id, record[0].id))
				.returning();
		}

		return { success: true, status: row.status };
	},

	omitir: async ({ locals, request }) => {
		const user = requireUser(locals);
		const formData = await request.formData();
		const appointmentId = formData.get('appointmentId')?.toString();
		if (!appointmentId) return { success: false, error: 'Faltan datos.' };

		const record = await db
			.select()
			.from(reminderRecords)
			.where(
				and(
					eq(reminderRecords.appointmentId, appointmentId),
					eq(reminderRecords.status, 'prepared')
				)
			)
			.orderBy(desc(reminderRecords.createdAt))
			.limit(1);

		const now = new Date();
		let row;
		if (record.length === 0) {
			[row] = await db
				.insert(reminderRecords)
				.values({
					id: randomUUID(),
					appointmentId,
					purpose: 'reminder',
					templateKey: 'initial',
					status: 'skipped',
					recordedBy: user.id,
					recordedAt: now,
					updatedAt: now
				})
				.returning();
		} else {
			[row] = await db
				.update(reminderRecords)
				.set({ status: 'skipped', recordedBy: user.id, recordedAt: now, updatedAt: now })
				.where(eq(reminderRecords.id, record[0].id))
				.returning();
		}

		return { success: true, status: row.status };
	},

	reenviar: async ({ locals, request }) => {
		const user = requireUser(locals);
		const formData = await request.formData();
		const appointmentId = formData.get('appointmentId')?.toString();
		const resentReason = formData.get('resent_reason')?.toString();
		if (!appointmentId) return { success: false, error: 'Faltan datos.' };

		const parsed = v.safeParse(resendSchema, { resent_reason: resentReason ?? '' });
		if (!parsed.success) {
			return { success: false, error: parsed.issues?.[0]?.message ?? 'Motivo requerido.' };
		}

		const reason = parsed.output.resent_reason ?? '';
		const now = new Date();
		await db.insert(reminderRecords).values({
			id: randomUUID(),
			appointmentId,
			purpose: 'resend',
			templateKey: 'initial',
			status: 'prepared',
			recordedBy: user.id,
			recordedAt: now,
			resentReason: reason,
			updatedAt: now
		});

		throw redirect(303, `/(app)/turnos/${appointmentId}/recordatorio`);
	}
};
