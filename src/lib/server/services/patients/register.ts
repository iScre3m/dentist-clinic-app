import { randomUUID } from 'node:crypto';
import { CONSENT_VERSION } from '#lib/server/consent.ts';
import { db } from '#lib/server/db/index.ts';
import { patients } from '#lib/server/db/schema.ts';
import type { RegistrationInput } from '#lib/schemas/patient.schema.ts';
import { normalizeMobile, type PhoneFailure } from './phone.ts';

export type RegisterFailure = PhoneFailure;
export type RegisterResult = { ok: true } | { ok: false; reason: RegisterFailure };

/**
 * Registration is idempotent: the phone number is the patient identity, so a
 * number that already exists updates the consent instead of creating a second
 * record. The caller must not reveal which case happened.
 *
 * Re-registering with the consent box checked is a new grant, so a previous
 * opt-out is cleared. `archived_at` is left untouched: unarchiving is a staff
 * decision.
 */
export async function registerPatient(input: RegistrationInput): Promise<RegisterResult> {
	const phone = normalizeMobile(input.phone);
	if (!phone.ok) {
		return { ok: false, reason: phone.reason };
	}

	const now = new Date();

	await db
		.insert(patients)
		.values({
			id: randomUUID(),
			name: input.firstName + ' ' + input.lastName,
			phone: phone.e164,
			whatsappConsent: 'granted',
			consentSource: 'registration',
			consentTextVersion: CONSENT_VERSION,
			consentRecordedAt: now,
			registeredAt: now,
			optedOutAt: null,
			updatedAt: now
		})
		.onConflictDoUpdate({
			target: patients.phone,
			set: {
				name: input.firstName + ' ' + input.lastName,
				whatsappConsent: 'granted',
				consentSource: 'registration',
				consentTextVersion: CONSENT_VERSION,
				consentRecordedAt: now,
				optedOutAt: null,
				updatedAt: now
			}
		});

	return { ok: true };
}
