import * as v from 'valibot';

const bcryptHashRegex = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export const authEnvSchema = v.object({
	AUTH_SECRET: v.pipe(
		v.string('AUTH_SECRET debe estar definido'),
		v.minLength(32, 'AUTH_SECRET debe tener al menos 32 caracteres')
	),
	AUTH_USERNAME: v.pipe(
		v.string('AUTH_USERNAME debe estar definido'),
		v.email('AUTH_USERNAME debe ser un email válido')
	),
	AUTH_PASSWORD_HASH: v.pipe(
		v.string('AUTH_PASSWORD_HASH debe estar definido'),
		v.regex(bcryptHashRegex, 'AUTH_PASSWORD_HASH debe ser un hash bcrypt válido')
	)
});

export type AuthEnv = v.InferOutput<typeof authEnvSchema>;

export function validateAuthEnv(env: Record<string, string | undefined>): AuthEnv {
	const result = v.safeParse(authEnvSchema, env);
	if (!result.success) {
		const issues = result.issues.map((issue) => issue.message).join('; ');
		throw new Error(`Falta o es inválido: ${issues}`);
	}
	return result.output;
}
