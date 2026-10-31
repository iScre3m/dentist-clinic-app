import { db } from '#lib/server/db/index.ts';
import { patients } from '#lib/server/db/schema.ts';
import { and, asc, count, eq, isNull, like, or, type SQL } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

/** A full patient list helps nobody; search is the real navigation. */
const PAGE_SIZE = 50;

function searchCondition(query: string): SQL | undefined {
	// `%` and `_` are LIKE wildcards; strip them rather than letting a search
	// term turn into an accidental "match everything".
	const nameLike = like(patients.name, `%${query.replace(/[%_]/g, '')}%`);

	const digits = query.replace(/\D/g, '');
	const phoneLike = digits === '' ? undefined : like(patients.phone, `%${digits}%`);

	return phoneLike ? or(nameLike, phoneLike) : nameLike;
}

export const load: PageServerLoad = async ({ url }) => {
	const query = (url.searchParams.get('q') ?? '').trim();
	const showArchived = url.searchParams.get('archivados') === '1';

	const conditions: (SQL | undefined)[] = [];
	conditions.push(showArchived ? undefined : isNull(patients.archivedAt));
	if (query) conditions.push(searchCondition(query));
	const where = and(...conditions.filter((condition): condition is SQL => condition !== undefined));

	const [totals] = await db.select({ total: count() }).from(patients).where(where);

	const list = await db
		.select({
			id: patients.id,
			name: patients.name,
			phone: patients.phone,
			phoneVerifiedAt: patients.phoneVerifiedAt,
			whatsappConsent: patients.whatsappConsent,
			registeredAt: patients.registeredAt,
			archivedAt: patients.archivedAt
		})
		.from(patients)
		.where(where)
		.orderBy(asc(patients.name))
		.limit(PAGE_SIZE);

	return { list, total: totals?.total ?? 0, query, showArchived };
};

export const actions: Actions = {
	confirmPhone: async ({ request }) => {
		const formData = await request.formData();
		const patientId = formData.get('patientId')?.toString();
		if (!patientId) {
			return { success: false, error: 'Faltan datos.' };
		}

		const [existing] = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
		if (!existing) {
			return { success: false, error: 'No encontramos ese paciente.' };
		}
		if (existing.phoneVerifiedAt) {
			return { success: false, error: 'El número ya estaba confirmado.' };
		}

		const now = new Date();
		await db
			.update(patients)
			.set({ phoneVerifiedAt: now, updatedAt: now })
			.where(eq(patients.id, patientId));

		return { success: true };
	}
};
