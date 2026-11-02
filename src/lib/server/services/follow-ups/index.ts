import { randomUUID } from 'node:crypto';
import { db } from '#lib/server/db/index.ts';
import { followUps } from '#lib/server/db/schema.ts';
import { and, asc, count, desc, eq, lt } from 'drizzle-orm';

export type FollowUpStatus = 'open' | 'done' | 'cancelled';

export type CreateFollowUpInput = {
	patientId: string;
	description: string;
	dueAt: Date;
	assignedTo: string;
};

export type CreateFollowUpResult =
	{ ok: true; id: string } | { ok: false; reason: 'not-found' | 'invalid-input' };

export type RecordContactResult =
	{ ok: true } | { ok: false; reason: 'not-found' | 'already-done' | 'already-cancelled' };

export type CompleteResult = RecordContactResult;

function alreadyReason(status: string): 'already-done' | 'already-cancelled' {
	return status === 'done' ? 'already-done' : 'already-cancelled';
}

/**
 * Create a follow-up task. `dueAt` is stored as a UTC millisecond timestamp;
 * the practice timezone is applied by the caller when collecting the date.
 */
export async function createFollowUp(input: CreateFollowUpInput): Promise<CreateFollowUpResult> {
	const description = input.description.trim();
	if (!description || description.length > 200) return { ok: false, reason: 'invalid-input' };
	if (!(input.dueAt instanceof Date) || Number.isNaN(input.dueAt.getTime())) {
		return { ok: false, reason: 'invalid-input' };
	}

	const id = randomUUID();
	const now = new Date();
	await db.insert(followUps).values({
		id,
		patientId: input.patientId,
		description,
		dueAt: input.dueAt,
		status: 'open',
		assignedTo: input.assignedTo,
		createdAt: now,
		updatedAt: now
	});
	return { ok: true, id };
}

/** Overwrites `last_contact_at` on every attempt. There is no per-attempt log. */
export async function recordContactAttempt(
	followUpId: string,
	contactAt: Date
): Promise<RecordContactResult> {
	const [row] = await db.select().from(followUps).where(eq(followUps.id, followUpId)).limit(1);
	if (!row) return { ok: false, reason: 'not-found' };
	if (row.status !== 'open') return { ok: false, reason: alreadyReason(row.status) };

	await db
		.update(followUps)
		.set({ lastContactAt: contactAt, updatedAt: new Date() })
		.where(eq(followUps.id, followUpId));
	return { ok: true };
}

/** Mark a follow-up complete. Completion is an explicit staff decision. */
export async function completeFollowUp(
	followUpId: string,
	completedBy: string
): Promise<CompleteResult> {
	const [row] = await db.select().from(followUps).where(eq(followUps.id, followUpId)).limit(1);
	if (!row) return { ok: false, reason: 'not-found' };
	if (row.status !== 'open') return { ok: false, reason: alreadyReason(row.status) };

	const now = new Date();
	await db
		.update(followUps)
		.set({ status: 'done', completedBy, completedAt: now, updatedAt: now })
		.where(eq(followUps.id, followUpId));
	return { ok: true };
}

export async function cancelFollowUp(followUpId: string): Promise<RecordContactResult> {
	const [row] = await db.select().from(followUps).where(eq(followUps.id, followUpId)).limit(1);
	if (!row) return { ok: false, reason: 'not-found' };
	if (row.status !== 'open') return { ok: false, reason: alreadyReason(row.status) };

	await db
		.update(followUps)
		.set({ status: 'cancelled', updatedAt: new Date() })
		.where(eq(followUps.id, followUpId));
	return { ok: true };
}

/** Open follow-ups for a patient, soonest due first. */
export async function listOpen(patientId: string, limit = 20) {
	return db
		.select()
		.from(followUps)
		.where(and(eq(followUps.patientId, patientId), eq(followUps.status, 'open')))
		.orderBy(asc(followUps.dueAt))
		.limit(limit);
}

/** Completed follow-ups for a patient, most recent first. */
export async function listDone(patientId: string, limit = 20) {
	return db
		.select()
		.from(followUps)
		.where(and(eq(followUps.patientId, patientId), eq(followUps.status, 'done')))
		.orderBy(desc(followUps.completedAt))
		.limit(limit);
}

/** All open follow-ups across patients, soonest due first. */
export async function listAllOpen(limit = 20) {
	return db
		.select()
		.from(followUps)
		.where(eq(followUps.status, 'open'))
		.orderBy(asc(followUps.dueAt))
		.limit(limit);
}

export function isOverdue(row: { dueAt: number | Date | null }): boolean {
	if (!row.dueAt) return false;
	const due = row.dueAt instanceof Date ? row.dueAt : new Date(row.dueAt);
	return due.getTime() < new Date().getTime();
}

/** Count of open follow-ups, split into pending and overdue. */
export async function summary(): Promise<{ open: number; overdue: number }> {
	const now = new Date();
	const [openRow] = await db
		.select({ total: count() })
		.from(followUps)
		.where(eq(followUps.status, 'open'));
	const [overdueRow] = await db
		.select({ total: count() })
		.from(followUps)
		.where(and(eq(followUps.status, 'open'), lt(followUps.dueAt, now)));
	return { open: openRow?.total ?? 0, overdue: overdueRow?.total ?? 0 };
}
