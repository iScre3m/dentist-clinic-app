import { fail } from '@sveltejs/kit';
import * as v from 'valibot';
import { phoneFailureMessage } from '#lib/copy.ts';
import { registrationSchema } from '#lib/schemas/patient.schema.ts';
import { CONSENT_TEXT, CONSENT_VERSION } from '#lib/server/consent.ts';
import { checkRateLimit } from '#lib/server/rate-limit.ts';
import { registerPatient } from '#lib/server/services/patients/register.ts';
import type { Actions, PageServerLoad } from './$types.ts';

const REGISTRATIONS_PER_HOUR = 5;

export const load: PageServerLoad = () => ({
	consentText: CONSENT_TEXT,
	consentVersion: CONSENT_VERSION
});

export const actions: Actions = {
	register: async ({ request, getClientAddress }) => {
		const form = await request.formData();
		const values = {
			firstName: String(form.get('firstName') ?? ''),
			lastName: String(form.get('lastName') ?? ''),
			phone: String(form.get('phone') ?? '')
		};

		if (!checkRateLimit(`registro:${getClientAddress()}`, REGISTRATIONS_PER_HOUR, 60 * 60 * 1000)) {
			return fail(429, {
				success: false,
				message: 'Recibimos demasiados registros desde esta conexión. Probá de nuevo más tarde.',
				values
			});
		}

		const parsed = v.safeParse(registrationSchema, {
			...values,
			consent: form.get('consent') === 'on'
		});

		if (!parsed.success) {
			return fail(400, {
				success: false,
				message: parsed.issues[0]?.message ?? 'Revisá los datos.',
				values
			});
		}

		const result = await registerPatient(parsed.output);
		if (!result.ok) {
			return fail(400, { success: false, message: phoneFailureMessage(result.reason), values });
		}

		return {
			success: true,
			message: 'Listo. Recibimos tu registro.',
			values: { firstName: '', lastName: '', phone: '' }
		};
	}
};
