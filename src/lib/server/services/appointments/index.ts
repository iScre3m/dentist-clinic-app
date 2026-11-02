import { db } from '#lib/server/db/index.ts';
import { appointments, reminderRecords, user } from '#lib/server/db/schema.ts';
import { and, asc, count, desc, eq, gte, lt, type SQL } from 'drizzle-orm';

export type AttendanceStatus = 'scheduled' | 'confirmed' | 'attended' | 'no_show';

export type RecordOutcomeResult =
	| { ok: true }
	| { ok: false; reason: 'not-found' | 'already-recorded' | 'invalid-state' | 'not-future' };

/**
 * Record an explicit attendance outcome. `confirmed` may only be set on a
 * future appointment; `attended` and `no_show` are recorded by staff after the
 * fact. Cancellation is not a local state: it comes from `calendar_status`.
 */
export async function recordOutcome(
	appointmentId: string,
	status: AttendanceStatus,
	userId: string
): Promise<RecordOutcomeResult> {
	const [row] = await db
		.select()
		.from(appointments)
		.where(eq(appointments.id, appointmentId))
		.limit(1);
	if (!row) return { ok: false, reason: 'not-found' };
	if (row.calendarStatus !== 'confirmed') return { ok: false, reason: 'invalid-state' };

	const now = new Date();
	const startsAt = row.startsAt ? new Date(row.startsAt) : null;
	const isFuture = startsAt ? startsAt.getTime() > now.getTime() : false;

	if (status === 'confirmed' && !isFuture) return { ok: false, reason: 'not-future' };

	await db
		.update(appointments)
		.set({
			attendanceStatus: status,
			confirmedAt: status === 'confirmed' ? now : row.confirmedAt,
			outcomeRecordedBy: userId,
			outcomeRecordedAt: now,
			updatedAt: now
		})
		.where(eq(appointments.id, appointmentId));
	return { ok: true };
}

/** Upcoming confirmed appointments for a patient, soonest first. */
export async function listUpcoming(patientId: string, limit = 20) {
	return db
		.select({
			id: appointments.id,
			summary: appointments.summary,
			startsAt: appointments.startsAt,
			endsAt: appointments.endsAt,
			allDay: appointments.allDay,
			localDate: appointments.localDate,
			attendanceStatus: appointments.attendanceStatus,
			calendarStatus: appointments.calendarStatus,
			confirmedAt: appointments.confirmedAt,
			outcomeRecordedAt: appointments.outcomeRecordedAt
		})
		.from(appointments)
		.where(and(eq(appointments.patientId, patientId), eq(appointments.calendarStatus, 'confirmed')))
		.orderBy(asc(appointments.startsAt))
		.limit(limit);
}

/**
 * Past confirmed appointments for a patient (starts before now), most recent
 * first. A cancelled appointment is not a past appointment with an outcome.
 */
export async function listPast(patientId: string, limit = 20) {
	const now = new Date();
	const conditions: (SQL | undefined)[] = [
		eq(appointments.patientId, patientId),
		eq(appointments.calendarStatus, 'confirmed')
	];
	if (conditions.push(lt(appointments.startsAt, now))) {
		// no-op
	}
	const where = and(...conditions.filter((c): c is SQL => c !== undefined));
	return db
		.select({
			id: appointments.id,
			summary: appointments.summary,
			startsAt: appointments.startsAt,
			endsAt: appointments.endsAt,
			allDay: appointments.allDay,
			localDate: appointments.localDate,
			attendanceStatus: appointments.attendanceStatus,
			outcomeRecordedAt: appointments.outcomeRecordedAt
		})
		.from(appointments)
		.where(where)
		.orderBy(desc(appointments.startsAt))
		.limit(limit);
}

/** Last reminder record for an appointment, if any. */
export async function lastReminder(appointmentId: string) {
	const rows = await db
		.select({
			id: reminderRecords.id,
			status: reminderRecords.status,
			templateKey: reminderRecords.templateKey,
			recordedAt: reminderRecords.recordedAt,
			resentReason: reminderRecords.resentReason,
			recordedByName: user.name
		})
		.from(reminderRecords)
		.leftJoin(user, eq(reminderRecords.recordedBy, user.id))
		.where(eq(reminderRecords.appointmentId, appointmentId))
		.orderBy(desc(reminderRecords.recordedAt))
		.limit(1);
	return rows[0] ?? null;
}

/** Reminder history for an appointment, most recent first. */
export async function listReminders(appointmentId: string, limit = 20) {
	return db
		.select({
			id: reminderRecords.id,
			purpose: reminderRecords.purpose,
			templateKey: reminderRecords.templateKey,
			status: reminderRecords.status,
			recordedAt: reminderRecords.recordedAt,
			resentReason: reminderRecords.resentReason,
			recordedByName: user.name
		})
		.from(reminderRecords)
		.leftJoin(user, eq(reminderRecords.recordedBy, user.id))
		.where(eq(reminderRecords.appointmentId, appointmentId))
		.orderBy(desc(reminderRecords.recordedAt))
		.limit(limit);
}

/** Count of future confirmed appointments for a patient. */
export async function countFuture(patientId: string): Promise<number> {
	const now = new Date();
	const [row] = await db
		.select({ total: count() })
		.from(appointments)
		.where(
			and(
				eq(appointments.patientId, patientId),
				eq(appointments.calendarStatus, 'confirmed'),
				gte(appointments.startsAt, now)
			)
		);
	return row?.total ?? 0;
}
