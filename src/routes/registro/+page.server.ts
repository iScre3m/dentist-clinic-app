import { fail } from '@sveltejs/kit';
import { getCountries } from 'libphonenumber-js/max';
import * as v from 'valibot';
import { registrationSchema } from '#lib/schemas/patient.schema.ts';
import { CONSENT_TEXT, CONSENT_VERSION } from '#lib/server/consent.ts';
import { checkRateLimit } from '#lib/server/rate-limit.ts';
import { registerPatient, type RegisterFailure } from '#lib/server/services/patients/register.ts';
import type { Actions, PageServerLoad } from './$types.ts';

const regionNames = new Intl.DisplayNames(['es-AR'], { type: 'region' });

const countries = getCountries()
	.map((code) => ({ code, name: regionNames.of(code) ?? code }))
	.sort((a, b) => a.name.localeCompare(b.name, 'es-AR'));

const REGISTRATIONS_PER_HOUR = 5;

function messageFor(reason: RegisterFailure): string {
	switch (reason) {
		case 'invalid-country':
			return 'Elegí un país de la lista.';
		case 'not-mobile':
			return 'Necesitamos un número de celular, porque WhatsApp no funciona con líneas fijas.';
		default:
			return 'El número no parece válido para el país elegido. Revisá el código de área y el número.';
	}
}

export const load: PageServerLoad = () => ({
	countries,
	defaultCountry: 'AR',
	consentText: CONSENT_TEXT,
	consentVersion: CONSENT_VERSION
});

export const actions: Actions = {
	register: async ({ request, getClientAddress }) => {
		const form = await request.formData();
		const values = {
			name: String(form.get('name') ?? ''),
			country: String(form.get('country') ?? 'AR'),
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
			return fail(400, { success: false, message: messageFor(result.reason), values });
		}

		return {
			success: true,
			message: 'Listo. Recibimos tu registro.',
			values: { name: '', country: values.country, phone: '' }
		};
	}
};
