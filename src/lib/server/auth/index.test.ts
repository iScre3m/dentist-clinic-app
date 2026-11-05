import { describe, expect, it } from 'vitest';
import { authenticate, handleJwtSession } from './index.js';
import { hashSync } from 'bcryptjs';

const SECRET = 'a'.repeat(32);
const HASH = hashSync('test-password', 10);

const env = {
	AUTH_SECRET: SECRET,
	AUTH_USERNAME: 'staff@example.com',
	AUTH_PASSWORD_HASH: HASH
} as Record<string, string | undefined>;

describe('authenticate', () => {
	it('creates a token for valid credentials', async () => {
		const token = await authenticate('staff@example.com', 'test-password', env);
		expect(typeof token).toBe('string');
		expect(token.length).toBeGreaterThan(0);
	});

	it('rejects a wrong username', async () => {
		await expect(authenticate('other@example.com', 'test-password', env)).rejects.toThrow(
			/Correo o contraseña/
		);
	});

	it('rejects a wrong password', async () => {
		await expect(authenticate('staff@example.com', 'wrong-password', env)).rejects.toThrow(
			/Correo o contraseña/
		);
	});

	it('rejects missing env variables', async () => {
		const incomplete = { ...env };
		delete incomplete.AUTH_SECRET;
		await expect(
			authenticate('staff@example.com', 'test-password', incomplete)
		).rejects.toThrow(/AUTH_SECRET/);
	});
});

describe('handleJwtSession', () => {
	it('returns a session for a valid token cookie', async () => {
		const token = await authenticate('staff@example.com', 'test-password', env);
		const session = handleJwtSession(`auth_token=${token}`, SECRET);
		expect(session).not.toBeNull();
		expect(session!.user.username).toBe('staff@example.com');
		expect(session!.user.role).toBe('staff');
		expect(session!.expiresAt.getTime()).toBeGreaterThan(Date.now());
	});

	it('returns null when there is no cookie', () => {
		expect(handleJwtSession(null, SECRET)).toBeNull();
		expect(handleJwtSession('', SECRET)).toBeNull();
	});

	it('returns null for an invalid token', () => {
		expect(handleJwtSession('auth_token=not-a-token', SECRET)).toBeNull();
		expect(handleJwtSession('auth_token=abc.def.ghi', SECRET)).toBeNull();
	});

	it('returns null for a token signed with a different secret', async () => {
		const token = await authenticate('staff@example.com', 'test-password', {
			...env,
			AUTH_SECRET: 'b'.repeat(32)
		});
		expect(handleJwtSession(`auth_token=${token}`, SECRET)).toBeNull();
	});
});
