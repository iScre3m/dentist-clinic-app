import * as v from 'valibot';

/**
 * Registration is the only patient-facing form. It collects the minimum:
 * a name for messages, a WhatsApp number, the country used to normalize it,
 * and the consent checkbox.
 */
export const registrationSchema = v.object({
	name: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(2, 'Escribí tu nombre.'),
		v.maxLength(80, 'El nombre es demasiado largo.')
	),
	country: v.pipe(v.string(), v.regex(/^[A-Z]{2}$/, 'Elegí un país de la lista.')),
	phone: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(6, 'Escribí tu número de WhatsApp.'),
		v.maxLength(30, 'El número es demasiado largo.')
	),
	consent: v.pipe(
		v.boolean(),
		v.literal(true, 'Tenés que aceptar el consentimiento para registrarte.')
	)
});

export type RegistrationInput = v.InferOutput<typeof registrationSchema>;
