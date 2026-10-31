/* eslint-disable */
import { db } from '#lib/server/db/index.ts';
import { appointments, patients, calendarSyncState } from '#lib/server/db/schema.ts';
import { and, asc, eq, gte, isNull } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { GoogleCalendarService } from '#lib/server/services/google-calendar/service.ts';
import { normalizeMobile } from '#lib/server/services/patients/phone.ts';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

export const load: PageServerLoad = async (event: any) => {
	const now = new Date();
	try {
		const lastSync = await db.select().from(calendarSyncState).where(eq(calendarSyncState.googleCalendarId, CALENDAR_ID)).limit(1);
		if (lastSync.length === 0 || !lastSync[0].lastSyncedAt || now.getTime() - new Date(lastSync[0].lastSyncedAt).getTime() > 5 * 60 * 1000) {
			const svc = new GoogleCalendarService();
			await svc.incrementalSync(CALENDAR_ID);
		}
	} catch (e) {}

	const upcoming = await db
		.select({
			id: appointments.id,
			summary: appointments.summary,
			startsAt: appointments.startsAt,
			allDay: appointments.allDay,
			attendanceStatus: appointments.attendanceStatus,
			calendarStatus: appointments.calendarStatus,
			patientName: patients.name,
			patientPhone: patients.phone,
			patientConsent: patients.whatsappConsent,
			patientOptedOutAt: patients.optedOutAt
		})
		.from(appointments)
		.leftJoin(patients, eq(appointments.patientId, patients.id))
		.where(and(gte(appointments.startsAt, now), eq(appointments.calendarStatus, 'confirmed')))
		.orderBy(asc(appointments.startsAt))
		.limit(20);

	const unmatched = await db
		.select({ id: appointments.id, summary: appointments.summary, startsAt: appointments.startsAt, allDay: appointments.allDay })
		.from(appointments)
		.where(and(isNull(appointments.patientId), eq(appointments.calendarStatus, 'confirmed')))
		.orderBy(asc(appointments.startsAt))
		.limit(20);

	const syncState = await db.select().from(calendarSyncState).where(eq(calendarSyncState.googleCalendarId, CALENDAR_ID)).limit(1);
	return { upcoming, unmatched, syncState: syncState[0] ?? null, user: event.locals.session?.user ?? null };
};

export const actions: Actions = {
	sync: async (event: any) => {
		const service = new GoogleCalendarService();
		try {
			const result = await service.fullSync(CALENDAR_ID);
			return { success: true, result };
		} catch (err) {
			return { success: false, error: (err as Error).message };
		}
	},
	incrementalSync: async (event: any) => {
		const service = new GoogleCalendarService();
		try {
			const result = await service.incrementalSync(CALENDAR_ID);
			return { success: true, result };
		} catch (err) {
			return { success: false, error: (err as Error).message };
		}
	},
	linkPatient: async (event: any) => {
		const formData = await event.request.formData();
		const appointmentId = formData.get('appointmentId')?.toString();
		const phone = formData.get('phone')?.toString();
		if (!appointmentId || !phone) return { success: false, error: 'Faltan datos' };
		const result = await normalizeMobile(phone, 'AR');
		if (!result.ok) return { success: false, error: 'Nómero invólido' };
		const patientRows = await db.select().from(patients).where(eq(patients.phone, result.e164)).limit(1);
		if (patientRows.length === 0) return { success: false, error: 'No se encontró un paciente con ese número' };
		await db.update(appointments).set({ patientId: patientRows[0].id }).where(eq(appointments.id, appointmentId));
		return { success: true };
	}
};


