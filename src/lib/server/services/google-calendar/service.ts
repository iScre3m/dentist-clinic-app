/**
 * Google Calendar service module.
 */

import { db } from '#lib/server/db/index.ts';
import { appointments, patients, calendarSyncState } from '#lib/server/db/schema.ts';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { normalizeMobile } from '#lib/server/services/patients/phone.ts';

type DecodedEvent = {
	eventId?: string;
	recurringEventId: string | null;
	summary: string;
	allDay: boolean;
	localDate: string | null;
	startsAt: number | null;
	endsAt: number | null;
	description: string;
	status?: string;
};
type GoogleEvent = {
	id?: string;
	summary?: string;
	title?: string;
	description?: string;
	start?: { date?: string; dateTime?: string };
	end?: { date?: string; dateTime?: string };
	status?: string;
	recurringEventId?: string;
	allDay?: boolean;
};

export const FIXTURES = [
	{
		id: 'dev-event-1',
		summary: 'Turno — Lucía Fernández',
		description: 'Paciente: +54 9 11 5555-0001',
		start: { dateTime: '2026-11-02T10:00:00-03:00' },
		end: { dateTime: '2026-11-02T10:45:00-03:00' },
		recurringEventId: 'dev-recur-1'
	},
	{
		id: 'dev-event-2',
		summary: 'Turno — Mateo Ramírez',
		description: '',
		start: { dateTime: '2026-11-03T14:30:00-03:00' },
		end: { dateTime: '2026-11-03T15:15:00-03:00' },
		recurringEventId: 'dev-recur-2'
	},
	{
		id: 'dev-event-3',
		summary: 'Turno',
		description: '',
		start: { date: '2026-11-05' },
		end: { date: '2026-11-05' },
		allDay: true,
		recurringEventId: 'dev-recur-3'
	},
	{
		id: 'dev-event-4',
		summary: 'Turno — Paciente eliminado',
		description: 'Paciente: +54 9 11 5555-0002',
		start: { dateTime: '2026-11-07T09:00:00-03:00' },
		end: { dateTime: '2026-11-07T09:45:00-03:00' },
		status: 'cancelled',
		recurringEventId: 'dev-recur-4'
	},
	{
		id: 'dev-event-5',
		summary: 'Turno — Fijo',
		description: 'Paciente: 011 5555-0001',
		start: { dateTime: '2026-11-08T11:00:00-03:00' },
		end: { dateTime: '2026-11-08T11:45:00-03:00' },
		recurringEventId: 'dev-recur-5'
	},
	{
		id: 'dev-event-6',
		summary: 'Nuevo turno sin paciente',
		description: '',
		start: { dateTime: '2026-11-10T15:00:00-03:00' },
		end: { dateTime: '2026-11-10T15:45:00-03:00' }
	}
];

export function simulateDelay(ms = 50): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GoogleCalendarService {
	private provider: unknown;

	constructor() {
		if (process.env.FAKE_CALENDAR === '1') {
			this.provider = {
				async fetchEvents(calendarId: string, timeMin: string, timeMax: string) {
					return FIXTURES.filter((ev: GoogleEvent) => {
						const start = ev.start?.dateTime ?? ev.start?.date;
						if (!start) return true;
						const sd = new Date(start);
						const min = new Date(timeMin);
						const max = new Date(timeMax);
						return sd >= min && sd <= max;
					});
				},
				async fetchEventsWithToken(_calendarId: string, _syncToken: string) {
					return { items: FIXTURES, nextSyncToken: 'fake-sync-token' };
				}
			};
		} else {
			const saBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
			if (!saBase64) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no está definido.');
			this.provider = {
				async fetchEvents() { return []; },
				async fetchEventsWithToken() { return { items: [], nextSyncToken: '' }; }
			};
		}
	}

	private async matchPatientByPhone(description?: string): Promise<string | null> {
		if (!description) return null;
		const match = description.match(/Paciente:\s*([+\d\s\-()]+)/i);
		if (!match) return null;
		const rawNumber = match[1].trim();
		const result = await normalizeMobile(rawNumber, 'AR');
		if (!result.ok) return null;
		const patientRows = await db
			.select({ id: patients.id })
			.from(patients)
			.where(eq(patients.phone, result.e164))
			.limit(1);
		if (patientRows.length === 0) return null;
		return patientRows[0].id;
	}

	private decodeEvent(raw: GoogleEvent): DecodedEvent {
		const event = raw as GoogleEvent;
		const startDate = event.start?.date ?? event.start?.dateTime;
		const endDate = event.end?.date ?? event.end?.dateTime;
		let allDay = false;
		let localDate: string | null = null;
		let startsAt: number | null = null;
		let endsAt: number | null = null;
		if (startDate && typeof startDate === 'string' && !startDate.includes('T')) {
			allDay = true;
			localDate = startDate;
			startsAt = new Date(startDate + 'T00:00:00-03:00').getTime();
		} else if (startDate) {
			startsAt = new Date(startDate).getTime();
			endsAt = endDate ? new Date(endDate).getTime() : null;
		}
		const summary = event.summary ?? event.title ?? 'Sin título';
		return {
			eventId: event.id,
			recurringEventId: event.recurringEventId ?? null,
			summary,
			allDay,
			localDate,
			startsAt,
			endsAt,
			description: event.description ?? '',
			status: event.status
		};
	}

	private async upsertAppointment(calendarId: string, ev: DecodedEvent, patientId?: string | null) {
		const existing = await db
			.select()
			.from(appointments)
			.where(and(eq(appointments.googleCalendarId, calendarId), eq(appointments.googleEventId, ev.eventId ?? '')))
			.limit(1);
		if (existing.length > 0) {
			await db
				.update(appointments)
				.set({
					patientId: patientId !== undefined ? patientId : existing[0].patientId,
					summary: ev.summary ?? 'Sin título',
					allDay: ev.allDay ?? false,
					localDate: ev.localDate ?? null,
startsAt: ev.startsAt ? new Date(ev.startsAt) : null,
endsAt: ev.endsAt ? new Date(ev.endsAt) : null,
					calendarStatus: ev.status === 'cancelled' ? 'cancelled' : 'confirmed',
					recurringEventId: ev.recurringEventId ?? existing[0].recurringEventId
				})
				.where(and(eq(appointments.googleCalendarId, calendarId), eq(appointments.googleEventId, ev.eventId ?? '')));
		} else {
			await db.insert(appointments).values({
				id: randomUUID(),
				patientId: patientId ?? null,
				googleCalendarId: calendarId,
				googleEventId: ev.eventId ?? randomUUID(),
				recurringEventId: ev.recurringEventId ?? null,
				summary: ev.summary ?? 'Sin título',
				allDay: ev.allDay ?? false,
				localDate: ev.localDate ?? null,
startsAt: ev.startsAt ? new Date(ev.startsAt) : null,
endsAt: ev.endsAt ? new Date(ev.endsAt) : null,
				attendanceStatus: 'scheduled',
				calendarStatus: ev.status === 'cancelled' ? 'cancelled' : 'confirmed'
			});
		}
	}

	private async recordSyncState(calendarId: string, syncToken?: string, lastSyncedAt?: Date, lastError?: string | null) {
		const now = lastSyncedAt ?? new Date();
		const existing = await db
			.select()
			.from(calendarSyncState)
			.where(eq(calendarSyncState.googleCalendarId, calendarId))
			.limit(1);
		if (existing.length > 0) {
			await db
				.update(calendarSyncState)
				.set({
					syncToken: syncToken !== undefined ? syncToken : existing[0].syncToken,
					lastSyncedAt: now,
					lastFullSyncAt: syncToken === undefined ? now : existing[0].lastFullSyncAt,
					lastError: lastError !== undefined ? lastError : existing[0].lastError
				})
				.where(eq(calendarSyncState.googleCalendarId, calendarId));
		} else {
			await db.insert(calendarSyncState).values({
				id: randomUUID(),
				googleCalendarId: calendarId,
				syncToken: syncToken ?? null,
				lastSyncedAt: now,
				lastFullSyncAt: now,
				lastError: lastError ?? null
			});
		}
	}

	async fullSync(calendarId: string): Promise<CalendarSyncResult> {
		const now = new Date();
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
		const ninetyDaysFromNow = new Date();
		ninetyDaysFromNow.setUTCDate(ninetyDaysFromNow.getUTCDate() + 90);

		let rawEvents: GoogleEvent[];
		try {
			rawEvents = await (this.provider as { fetchEvents: (a: string, b: string, c: string) => Promise<GoogleEvent[]> }).fetchEvents(calendarId, thirtyDaysAgo.toISOString(), ninetyDaysFromNow.toISOString());
		} catch (err) {
			await this.recordSyncState(calendarId, undefined, now, (err as Error).message);
			throw new Error(`Sync fallida: ${(err as Error).message}`, { cause: err });
		}

		await simulateDelay();
		const decoded = rawEvents.map((e: GoogleEvent) => this.decodeEvent(e));

		const allRecords = await db
			.select()
			.from(appointments)
			.where(eq(appointments.googleCalendarId, calendarId));
		const existingEventIds = new Set(allRecords.map((a) => a.googleEventId));
		const appearingIds = new Set<string>();

		let eventsMatched = 0;
		let eventsUnmatched = 0;

		for (const ev of decoded) {
			if (ev.eventId) appearingIds.add(ev.eventId);
			const patientId = await this.matchPatientByPhone(ev.description);
			if (patientId) eventsMatched++;
			else eventsUnmatched++;

			if (existingEventIds.has(ev.eventId ?? '')) {
				await this.upsertAppointment(calendarId, ev, patientId);
			} else {
				await this.upsertAppointment(calendarId, ev, patientId);
			}
		}

		for (const existing of allRecords) {
			const stillAppears = appearingIds.has(existing.googleEventId);
			if (!stillAppears && existing.calendarStatus !== 'cancelled') {
				await db.update(appointments).set({ calendarStatus: 'deleted' }).where(eq(appointments.id, existing.id));
			}
		}

		await this.recordSyncState(calendarId, undefined, now, null);
		return {
			eventsCreated: 0,
			eventsUpdated: 0,
			eventsCancelled: 0,
			eventsUnmatched,
			eventsMatched,
			eventsOutsideWindow: 0
		};
	}

	async incrementalSync(calendarId: string): Promise<CalendarSyncResult> {
		const now = new Date();
		const lastState = await db
			.select()
			.from(calendarSyncState)
			.where(eq(calendarSyncState.googleCalendarId, calendarId))
			.limit(1);
		const lastSync = lastState[0];
		const syncToken = lastSync?.syncToken;

		if (!syncToken) {
			return this.fullSync(calendarId);
		}

		let result: { items?: GoogleEvent[]; nextSyncToken?: string };
		try {
			result = await (this.provider as { fetchEventsWithToken: (a: string, b: string) => Promise<{ items?: GoogleEvent[]; nextSyncToken?: string }> }).fetchEventsWithToken(calendarId, syncToken);
		} catch (err: unknown) {
			if ((err as { status?: number })?.status === 410) {
				await this.recordSyncState(calendarId, undefined, now, 'sync token expired');
				return this.fullSync(calendarId);
			}
			await this.recordSyncState(calendarId, syncToken, now, (err as Error).message);
			throw new Error(`Sync fallida: ${(err as Error).message}`, { cause: err });
		}

		await simulateDelay();
		const rawEvents = result.items ?? [];
		const decoded = rawEvents.map((e: GoogleEvent) => this.decodeEvent(e));

		const allRecords = await db
			.select()
			.from(appointments)
			.where(eq(appointments.googleCalendarId, calendarId));
		const existingEventIds = new Set(allRecords.map((a) => a.googleEventId));
		const appearingIds = new Set<string>();

		let eventsMatched = 0;
		let eventsUnmatched = 0;

		for (const ev of decoded) {
			if (ev.eventId) appearingIds.add(ev.eventId);
			const patientId = await this.matchPatientByPhone(ev.description);
			if (patientId) eventsMatched++;
			else eventsUnmatched++;

			if (existingEventIds.has(ev.eventId ?? '')) {
				await this.upsertAppointment(calendarId, ev, patientId);
			} else {
				await this.upsertAppointment(calendarId, ev, patientId);
			}
		}

		for (const existing of allRecords) {
			const stillAppears = appearingIds.has(existing.googleEventId);
			if (!stillAppears && existing.calendarStatus !== 'cancelled') {
				await db.update(appointments).set({ calendarStatus: 'deleted' }).where(eq(appointments.id, existing.id));
			}
		}

		const nextToken = result.nextSyncToken ?? syncToken;
		await this.recordSyncState(calendarId, nextToken, now, null);
		return {
			eventsCreated: 0,
			eventsUpdated: 0,
			eventsCancelled: 0,
			eventsUnmatched,
			eventsMatched,
			eventsOutsideWindow: 0
		};
	}
}

export interface CalendarSyncResult {
	eventsCreated: number;
	eventsUpdated: number;
	eventsCancelled: number;
	eventsUnmatched: number;
	eventsMatched: number;
	eventsOutsideWindow: number;
	lastError?: string;
}
