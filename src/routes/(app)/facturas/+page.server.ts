import { requireUser } from '#lib/server/session.ts';
import { db } from '#lib/server/db/index.ts';
import { invoiceHistory } from '#lib/server/db/schema.ts';
import { desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireUser(locals);
	const invoices = await db.select().from(invoiceHistory).orderBy(desc(invoiceHistory.createdAt)).limit(50);
	return { invoices };
};
