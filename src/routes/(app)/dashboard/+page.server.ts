import { db } from '#lib/server/db/index.ts';
import { appointments, patients } from '#lib/server/db/schema.ts';
import { and, asc, eq, gte, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const now = new Date();

	const upcoming = await db
		.select({
			id: appointments.id,
			summary: appointments.summary,
			startsAt: appointments.startsAt,
			allDay: appointments.allDay,
			attendanceStatus: appointments.attendanceStatus,
			patientName: patients.name,
			patientPhone: patients.phone
		})
		.from(appointments)
		.leftJoin(patients, eq(appointments.patientId, patients.id))
		.where(and(gte(appointments.startsAt, now), eq(appointments.calendarStatus, 'confirmed')))
		.orderBy(asc(appointments.startsAt))
		.limit(20);

	const unmatched = await db
		.select({
			id: appointments.id,
			summary: appointments.summary,
			startsAt: appointments.startsAt
		})
		.from(appointments)
		.where(
			and(
				isNull(appointments.patientId),
				gte(appointments.startsAt, now),
				eq(appointments.calendarStatus, 'confirmed')
			)
		)
		.orderBy(asc(appointments.startsAt))
		.limit(20);

	return { upcoming, unmatched };
};
