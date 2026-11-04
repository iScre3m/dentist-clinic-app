/**
 * Nylas calendar service (sandbox).
 *
 * Reads today's events from the practice calendar through a Nylas grant,
 * stores each one as a local appointment and matches patients by the phone
 * number in the event description (`Paciente: +54 9 11 ...`), reusing the
 * same upsert and sync-state rules as the Google Calendar service.
 */

import Nylas from 'nylas';
import type { Event } from 'nylas';
import '../../load-env.ts';
import {
	matchPatientByPhone,
	recordSyncState,
	upsertAppointment,
	type DecodedEvent
} from '#lib/server/services/google-calendar/service.ts';

const TIMEZONE = 'America/Argentina/Buenos_Aires';

export interface NylasTodayReadResult {
	eventsRead: number;
	eventsMatched: number;
	eventsUnmatched: number;
}

/** Nylas uses Unix seconds; normalize defensively (guard for ms epoch values). */
function epochToMs(value: number): number {
	return value < 10_000_000_000 ? value * 1000 : value;
}

function decodeNylasWhen(when: Event['when']): {
	allDay: boolean;
	localDate: string | null;
	startsAt: number | null;
	endsAt: number | null;
} {
	if ('startTime' in when && 'endTime' in when) {
		return {
			allDay: false,
			localDate: null,
			startsAt: epochToMs(when.startTime),
			endsAt: epochToMs(when.endTime)
		};
	}
	if ('time' in when) {
		return {
			allDay: false,
			localDate: null,
			startsAt: epochToMs(when.time),
			endsAt: null
		};
	}
	if ('startDate' in when && 'endDate' in when) {
		return {
			allDay: true,
			localDate: when.startDate,
			startsAt: new Date(`${when.startDate}T00:00:00-03:00`).getTime(),
			endsAt: null
		};
	}
	if ('date' in when) {
		return {
			allDay: true,
			localDate: when.date,
			startsAt: new Date(`${when.date}T00:00:00-03:00`).getTime(),
			endsAt: null
		};
	}
	return { allDay: false, localDate: null, startsAt: null, endsAt: null };
}

export function decodeNylasEvent(ev: Event): DecodedEvent {
	const when = decodeNylasWhen(ev.when);
	return {
		eventId: ev.id,
		recurringEventId: ev.masterEventId ?? null,
		summary: ev.title ?? 'Sin título',
		...when,
		description: ev.description ?? '',
		status: ev.status
	};
}

/** Today's date (YYYY-MM-DD) in the practice timezone. */
export function todayYmd(now: Date = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: TIMEZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(now);
}

/**
 * Read the calendar from today and store each event as a local appointment.
 * The window covers the whole current day in America/Argentina/Buenos_Aires.
 */
export async function readTodayEvents(calendarId?: string): Promise<NylasTodayReadResult> {
	const apiKey = process.env.NYLAS_API_KEY;
	const grantId = process.env.NYLAS_GRANT_ID;
	if (!apiKey || !grantId) {
		throw new Error('Falta configurar NYLAS_API_KEY y NYLAS_GRANT_ID.');
	}
	const calendar = calendarId ?? process.env.NYLAS_CALENDAR_ID ?? 'primary';

	const ymd = todayYmd();
	const startEpoch = Math.floor(new Date(`${ymd}T00:00:00-03:00`).getTime() / 1000);
	const endEpoch = Math.floor(new Date(`${ymd}T23:59:59-03:00`).getTime() / 1000);

	const nylas = new Nylas({ apiKey });
	let events: Event[];
	const now = new Date();
	try {
		const response = await nylas.events.list({
			identifier: grantId,
			queryParams: {
				calendarId: calendar,
				start: String(startEpoch),
				end: String(endEpoch),
				limit: 50,
				expandRecurring: true
			}
		});
		events = response.data;
	} catch (err: unknown) {
		await recordSyncState(calendar, undefined, now, (err as Error).message);
		throw err;
	}

	let eventsMatched = 0;
	let eventsUnmatched = 0;
	for (const ev of events) {
		const decoded = decodeNylasEvent(ev);
		const patientId = await matchPatientByPhone(decoded.description);
		if (patientId) eventsMatched++;
		else eventsUnmatched++;
		await upsertAppointment(calendar, decoded, patientId);
	}

	await recordSyncState(calendar, undefined, new Date(), null);
	return { eventsRead: events.length, eventsMatched, eventsUnmatched };
}
