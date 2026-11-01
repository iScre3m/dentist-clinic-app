import * as v from 'valibot';

export const registrationSchema = v.object({
	firstName: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(2, 'Escribí tu nombre.'),
		v.maxLength(80, 'El nombre es demasiado largo.'),
		v.regex(/^[\p{L}\s'-]+$/u, 'Solo letras, espacios y apóstrofos.')
	),
	lastName: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(2, 'Escribí tu apellido.'),
		v.maxLength(80, 'El apellido es demasiado largo.'),
		v.regex(/^[\p{L}\s'-]+$/u, 'Solo letras, espacios y apóstrofos.')
	),
	country: v.pipe(v.string(), v.regex(/^[A-Z]{2}$/, 'Elegí un país de la lista.')),
	phone: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(6, 'Escribí tu número de WhatsApp.'),
		v.maxLength(30, 'El número es demasiado largo.'),
		v.regex(/^\d+$/, 'Solo números.')
	),
	consent: v.pipe(
		v.boolean(),
		v.literal(true, 'Tenés que aceptar el consentimiento para registrarte.')
	)
});

export type RegistrationInput = v.InferOutput<typeof registrationSchema>;

export const staffEditSchema = v.object({
	name: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(2, 'Escribí el nombre del paciente.'),
		v.maxLength(80, 'El nombre es demasiado largo.')
	),
	country: v.pipe(v.string(), v.regex(/^[A-Z]{2}$/, 'Elegí un país de la lista.')),
	phone: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(6, 'Escribí el número de WhatsApp.'),
		v.maxLength(30, 'El número es demasiado largo.')
	),
	email: v.optional(
		v.pipe(
			v.string(),
			v.trim(),
			v.maxLength(200, 'El correo es demasiado largo.'),
			v.check(
				(value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
				'Ingresá un correo válido o dejá el campo vacío.'
			)
		),
		''
	)
});

export type StaffEditInput = v.InferOutput<typeof staffEditSchema>;

export const consentChangeSchema = v.object({
	consent: v.picklist(['granted', 'denied'], 'Elegí una opción.')
});

export type ConsentChangeInput = v.InferOutput<typeof consentChangeSchema>;
