import { CONSENT_VERSION } from '#lib/server/consent.ts';
import { db } from '#lib/server/db/index.ts';
import { appointments, patients } from '#lib/server/db/schema.ts';
import { localDateKey } from '#lib/format.ts';
import type { StaffEditInput } from '#lib/schemas/patient.schema.ts';
import { and, count, eq, gte, isNull, ne, or } from 'drizzle-orm';
import { normalizeMobile, type PhoneFailure } from './phone.ts';

export type StaffFailure = PhoneFailure | 'phone-taken' | 'not-found';
export type StaffResult =
	{ ok: true; phoneChanged?: boolean } | { ok: false; reason: StaffFailure };
export type VerifyResult =
	{ ok: true; alreadyVerified: boolean } | { ok: false; reason: 'not-found' };
export type ArchiveResult =
	| { ok: true }
	| { ok: false; reason: 'has-future-appointments'; count: number }
	| { ok: false; reason: 'not-found' };

export async function getPatient(id: string) {
	const rows = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
	return rows[0];
}

/** better-sqlite3 surfaces constraint violations through the error's `code`;
 * D1's SQLite loses the code and only keeps it in the message. */
function isConstraintError(value: unknown): boolean {
	if (typeof value !== 'object' || value === null) return false;
	if (
		'code' in value &&
		String((value as { code: unknown }).code).startsWith('SQLITE_CONSTRAINT')
	) {
		return true;
	}
	return 'message' in value && String((value as { message: unknown }).message)
		.toLowerCase()
		.includes('constraint failed');
}

/**
 * Correct a patient's name, number or email. The phone is re-normalized with
 * the same rules as registration, so the number stays the patient's identity.
 * A number that already belongs to another patient is rejected with a clear
 * message instead of a database error. When the number changes, the
 * verification is cleared: staff have to confirm the new number again.
 */
export async function updateContact(
	patientId: string,
	input: StaffEditInput
): Promise<StaffResult> {
	const current = await getPatient(patientId);
	if (!current) return { ok: false, reason: 'not-found' };

	const phone = normalizeMobile(input.phone);
	if (!phone.ok) return { ok: false, reason: phone.reason };

	const phoneChanged = phone.e164 !== current.phone;

	if (phoneChanged) {
		const taken = await db
			.select({ id: patients.id })
			.from(patients)
			.where(and(eq(patients.phone, phone.e164), ne(patients.id, patientId)))
			.limit(1);
		if (taken.length > 0) return { ok: false, reason: 'phone-taken' };
	}

	try {
		await db
			.update(patients)
			.set({
				name: input.name,
				phone: phone.e164,
				email: input.email === '' ? null : input.email,
				// An unverified number must never keep the old confirmation.
				...(phoneChanged ? { phoneVerifiedAt: null } : {}),
				updatedAt: new Date()
			})
			.where(eq(patients.id, patientId));
	} catch (error) {
		if (isConstraintError(error)) return { ok: false, reason: 'phone-taken' };
		throw error;
	}

	return { ok: true, phoneChanged };
}

/**
 * Confirm the number the patient is reached at, usually at the first visit.
 * Re-confirming an already verified number does not move the date.
 */
export async function verifyPatientPhone(patientId: string): Promise<VerifyResult> {
	const current = await getPatient(patientId);
	if (!current) return { ok: false, reason: 'not-found' };
	if (current.phoneVerifiedAt) return { ok: true, alreadyVerified: true };

	await db
		.update(patients)
		.set({ phoneVerifiedAt: new Date(), updatedAt: new Date() })
		.where(eq(patients.id, patientId));

	return { ok: true, alreadyVerified: false };
}

/**
 * Record a consent change made by staff. A denial is a withdrawal: it stamps
 * `opted_out_at`. A grant is an explicit re-authorization, so a previous
 * opt-out is cleared (the same rule the registration flow applies).
 */
export async function setStaffConsent(
	patientId: string,
	consent: 'granted' | 'denied'
): Promise<StaffResult> {
	const current = await getPatient(patientId);
	if (!current) return { ok: false, reason: 'not-found' };

	const now = new Date();
	await db
		.update(patients)
		.set({
			whatsappConsent: consent,
			consentSource: 'staff',
			consentTextVersion: CONSENT_VERSION,
			consentRecordedAt: now,
			optedOutAt: consent === 'denied' ? now : null,
			updatedAt: now
		})
		.where(eq(patients.id, patientId));

	return { ok: true };
}

/**
 * Archive hides the patient from lists and search without touching linked
 * records. Archiving is blocked while future appointments exist, so nobody
 * silently loses a pending reminder; the message says how many.
 */
export async function archivePatient(patientId: string): Promise<ArchiveResult> {
	const current = await getPatient(patientId);
	if (!current) return { ok: false, reason: 'not-found' };
	if (current.archivedAt) return { ok: true };

	const now = new Date();
	const today = localDateKey(now);
	const isFuture = or(
		gte(appointments.startsAt, now),
		and(isNull(appointments.startsAt), gte(appointments.localDate, today))
	);

	const [future] = await db
		.select({ total: count() })
		.from(appointments)
		.where(
			and(
				eq(appointments.patientId, patientId),
				eq(appointments.calendarStatus, 'confirmed'),
				isFuture
			)
		);

	if (future && future.total > 0) {
		return { ok: false, reason: 'has-future-appointments', count: future.total };
	}

	await db
		.update(patients)
		.set({ archivedAt: now, updatedAt: now })
		.where(eq(patients.id, patientId));

	return { ok: true };
}
