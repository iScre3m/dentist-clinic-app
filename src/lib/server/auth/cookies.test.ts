import { describe, expect, it } from 'vitest';
import { setAuthCookie, clearAuthCookie, getAuthCookie } from './cookies';

function makeResponse(): Response & { cookies: string[] } {
	const headers: Record<string, string[]> = {};
	return {
		headers: {
			append(name: string, value: string) {
				const key = name.toLowerCase();
				(key in headers ? headers[key] : (headers[key] = [])).push(value);
			}
		},
		get cookies() {
			return headers['set-cookie'] ?? [];
		}
	} as unknown as Response & { cookies: string[] };
}

describe('setAuthCookie', () => {
	it('sets an httpOnly auth_token cookie with 7-day max-age and sameSite Lax', () => {
		const response = makeResponse();
		setAuthCookie(response, 'token-123');
		const cookie = response.cookies[0];
		expect(cookie).toContain('auth_token=token-123');
		expect(cookie).toContain('Path=/');
		expect(cookie).toContain('HttpOnly');
		expect(cookie).toContain('SameSite=Lax');
		expect(cookie).toContain('Max-Age=604800');
	});

	it('does not set Secure in non-production', () => {
		const response = makeResponse();
		setAuthCookie(response, 'token-123');
		expect(response.cookies[0]).not.toContain('Secure');
	});
});

describe('clearAuthCookie', () => {
	it('clears the auth_token cookie with an expired date', () => {
		const response = makeResponse();
		clearAuthCookie(response);
		const cookie = response.cookies[0];
		expect(cookie).toContain('auth_token=');
		expect(cookie).toContain('expires=Thu, 01 Jan 1970 00:00:00 GMT');
		expect(cookie).toContain('HttpOnly');
	});
});

describe('getAuthCookie', () => {
	it('extracts the token value from a cookie header', () => {
		expect(getAuthCookie('auth_token=abc123; other=x')).toBe('abc123');
		expect(getAuthCookie('other=x; auth_token=abc123')).toBe('abc123');
		expect(getAuthCookie('other=x')).toBeNull();
		expect(getAuthCookie(null)).toBeNull();
		expect(getAuthCookie('')).toBeNull();
	});
});
