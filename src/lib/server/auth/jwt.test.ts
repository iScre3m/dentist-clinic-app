import { describe, expect, it } from 'vitest';
import { createToken, verifyToken, isTokenExpired, type JwtPayload } from './jwt';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';

describe('createToken', () => {
	it('issues a token with the staff subject, username, role and 7-day expiry', () => {
		const token = createToken('staff@example.com', SECRET);
		expect(typeof token).toBe('string');

		const payload = verifyToken(token, SECRET);
		expect(payload).not.toBeNull();
		expect(payload!.sub).toBe('staff');
		expect(payload!.username).toBe('staff@example.com');
		expect(payload!.role).toBe('staff');

		const now = Math.floor(Date.now() / 1000);
		expect(payload!.exp - now).toBeCloseTo(60 * 60 * 24 * 7, -1);
		expect(payload!.iat).toBeLessThanOrEqual(now);
	});
});

describe('verifyToken', () => {
	it('returns null for a tampered token', () => {
		const good = createToken('staff@example.com', SECRET);
		const tampered = good.slice(0, -5) + 'xxxxx';
		expect(verifyToken(tampered, SECRET)).toBeNull();
	});

	it('returns null for a token signed with a different secret', () => {
		const token = createToken('staff@example.com', SECRET);
		expect(verifyToken(token, 'other-secret-that-is-at-least-32-characters-long')).toBeNull();
	});

	it('returns null for a malformed token', () => {
		expect(verifyToken('not-a-token', SECRET)).toBeNull();
		expect(verifyToken('', SECRET)).toBeNull();
	});
});

describe('isTokenExpired', () => {
	it('reports a token with a future expiry as not expired', () => {
		const payload: JwtPayload = {
			sub: 'staff',
			username: 'staff@example.com',
			role: 'staff',
			iat: Math.floor(Date.now() / 1000) - 100,
			exp: Math.floor(Date.now() / 1000) + 1000
		};
		expect(isTokenExpired(payload)).toBe(false);
	});

	it('reports a token with a past expiry as expired', () => {
		const payload: JwtPayload = {
			sub: 'staff',
			username: 'staff@example.com',
			role: 'staff',
			iat: Math.floor(Date.now() / 1000) - 2000,
			exp: Math.floor(Date.now() / 1000) - 1000
		};
		expect(isTokenExpired(payload)).toBe(true);
	});
});
