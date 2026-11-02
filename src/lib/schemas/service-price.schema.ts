import * as v from 'valibot';

/** Kebab-case slug identifying the service type (e.g. "consulta", "limpieza"). */
const serviceTypeSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(2, 'Escribí el identificador de la práctica.'),
	v.maxLength(40, 'El identificador es demasiado largo.'),
	v.regex(/^[a-z]+(-[a-z]+)*$/, 'El identificador solo puede tener letras minúsculas y guiones.')
);

export const createServicePriceSchema = v.object({
	serviceType: serviceTypeSchema,
	name: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(2, 'Escribí el nombre de la práctica.'),
		v.maxLength(60, 'El nombre es demasiado largo.')
	),
	price: v.pipe(
		v.number('Ingresá un precio.'),
		v.integer('El precio no puede tener decimales.'),
		v.minValue(0, 'El precio no puede ser negativo.'),
		v.maxValue(9_999_999, 'El precio es demasiado alto.')
	)
});

export type CreateServicePriceInput = v.InferOutput<typeof createServicePriceSchema>;

export const updateServicePriceSchema = v.object({
	servicePriceId: v.pipe(v.string(), v.uuid('Práctica inválida.')),
	price: v.pipe(
		v.number('Ingresá un precio.'),
		v.integer('El precio no puede tener decimales.'),
		v.minValue(0, 'El precio no puede ser negativo.'),
		v.maxValue(9_999_999, 'El precio es demasiado alto.')
	)
});

export type UpdateServicePriceInput = v.InferOutput<typeof updateServicePriceSchema>;

export const setServicePriceActiveSchema = v.object({
	servicePriceId: v.pipe(v.string(), v.uuid('Práctica inválida.')),
	isActive: v.boolean('Elegí una opción.')
});

export type SetServicePriceActiveInput = v.InferOutput<typeof setServicePriceActiveSchema>;
