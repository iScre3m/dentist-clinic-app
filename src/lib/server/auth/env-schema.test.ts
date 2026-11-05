import { describe, expect, it } from 'vitest';
import {
	validateAuthEnv,
	type AuthEnv
} from './env-schema';

const baseEnv = {
	AUTH_SECRET: 'a'.repeat(32),
	AUTH_USERNAME: 'staff@example.com',
	AUTH_PASSWORD_HASH: '$2b$10$RBH6ylP7jIunMU2VKXZVNOgJRTjhYeQyrNIvf1UYokBFOpmPbEqMi'
};

describe('validateAuthEnv', () => {
	it('returns the validated env when all variables are present and valid', () => {
		const result = validateAuthEnv({ ...baseEnv });
		expect(result).toMatchObject({
			AUTH_SECRET: baseEnv.AUTH_SECRET,
			AUTH_USERNAME: baseEnv.AUTH_USERNAME,
			AUTH_PASSWORD_HASH: baseEnv.AUTH_PASSWORD_HASH
		});
	});

	it('throws when AUTH_SECRET is missing', () => {
		const { AUTH_SECRET, ...rest } = baseEnv;
		expect(() => validateAuthEnv(rest as AuthEnv)).toThrow(/AUTH_SECRET/);
	});

	it('throws when AUTH_SECRET is shorter than 32 characters', () => {
		expect(() => validateAuthEnv({ ...baseEnv, AUTH_SECRET: 'short' })).toThrow(
			/32 caracteres/
		);
	});

	it('throws when AUTH_USERNAME is missing', () => {
		const { AUTH_USERNAME, ...rest } = baseEnv;
		expect(() => validateAuthEnv(rest as AuthEnv)).toThrow(/AUTH_USERNAME/);
	});

	it('throws when AUTH_USERNAME is not an email', () => {
		expect(() => validateAuthEnv({ ...baseEnv, AUTH_USERNAME: 'not-an-email' })).toThrow(
			/email/
		);
	});

	it('throws when AUTH_PASSWORD_HASH is missing', () => {
		const { AUTH_PASSWORD_HASH, ...rest } = baseEnv;
		expect(() => validateAuthEnv(rest as AuthEnv)).toThrow(/AUTH_PASSWORD_HASH/);
	});

	it('throws when AUTH_PASSWORD_HASH is not a bcrypt hash', () => {
		expect(() => validateAuthEnv({ ...baseEnv, AUTH_PASSWORD_HASH: 'not-a-hash' })).toThrow(
			/bcrypt/
		);
	});
});
