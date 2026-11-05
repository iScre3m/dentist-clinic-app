/**
 * Integration tests for the JWT authentication API endpoints.
 *
 * Uses Playwright's `request` API to hit `/api/login`, `/api/logout` and
 * `/api/session` directly — no browser needed.  Tests cover:
 *
 * 1. Login with valid credentials → 200 + Set-Cookie
 * 2. Login with invalid password → 401
 * 3. Login with unknown username → 401 (same message as invalid password)
 * 4. Login with missing fields → 400
 * 5. Session endpoint with valid cookie → 200 + user info
 * 6. Session endpoint without cookie → 401
 * 7. Logout clears the auth_token cookie
 * 8. Rate limiting blocks excessive attempts (429)
 */

import { test, expect } from '@playwright/test';
import type { APIResponse } from '@playwright/test';
import { STAFF_EMAIL, STAFF_PASSWORD } from './support/env';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * The login rate limiter keys failed attempts by client IP
 * (`x-forwarded-for`). Parallel workers share the same local IP, so every
 * test posts with its own synthetic IP: state stays isolated between tests
 * and each test can rely on a fresh 5-attempt budget.
 *
 * IP scheme: 203.0.<workerIndex+1>.<testCounter> — tests run one at a time
 * per worker, so concurrent tests always sit on different workers and can
 * never repeat the same IP. Must be called inside a running test.
 */
let testIpCounter = 0;

function nextTestIp(): string {
	const worker = test.info().workerIndex + 1;
	testIpCounter += 1;
	return `203.0.${worker}.${testIpCounter}`;
}

function loginHeaders(ip: string): Record<string, string> {
	return { 'x-forwarded-for': ip };
}

/** Extract the auth_token cookie value from an API response's Set-Cookie header. */
function extractAuthToken(response: APIResponse): string | null {
	const setCookie = response.headers()['set-cookie'];
	if (!setCookie) return null;
	const match = setCookie.match(/auth_token=([^;]+)/);
	return match ? match[1] : null;
}

/* ------------------------------------------------------------------ */
/*  Login                                                              */
/* ------------------------------------------------------------------ */

test.describe('POST /api/login', () => {
	test('returns 200 and sets an auth_token cookie with valid credentials', async ({ request }) => {
		const ip = nextTestIp();
		const response = await request.post('/api/login', {
			data: { username: STAFF_EMAIL, password: STAFF_PASSWORD },
			headers: loginHeaders(ip)
		});

		expect(response.status()).toBe(200);
		expect(await response.json()).toEqual({ success: true });

		const token = extractAuthToken(response);
		expect(token).not.toBeNull();
		expect(typeof token!).toBe('string');
		expect(token!.length).toBeGreaterThan(10);
	});

	test('returns 401 with an invalid password', async ({ request }) => {
		const ip = nextTestIp();
		const response = await request.post('/api/login', {
			data: { username: STAFF_EMAIL, password: 'wrong-password' },
			headers: loginHeaders(ip)
		});

		expect(response.status()).toBe(401);
		const body = await response.json();
		expect(body).toHaveProperty('error');
		expect(typeof body.error).toBe('string');
	});

	test('returns 401 with an unknown username', async ({ request }) => {
		const ip = nextTestIp();
		const response = await request.post('/api/login', {
			data: { username: 'nobody@example.com', password: STAFF_PASSWORD },
			headers: loginHeaders(ip)
		});

		expect(response.status()).toBe(401);
		const body = await response.json();
		expect(body).toHaveProperty('error');
	});

	test('returns 400 when username is missing', async ({ request }) => {
		const ip = nextTestIp();
		const response = await request.post('/api/login', {
			data: { password: STAFF_PASSWORD },
			headers: loginHeaders(ip)
		});

		expect(response.status()).toBe(400);
		const body = await response.json();
		expect(body).toHaveProperty('error');
	});

	test('returns 400 when password is missing', async ({ request }) => {
		const ip = nextTestIp();
		const response = await request.post('/api/login', {
			data: { username: STAFF_EMAIL },
			headers: loginHeaders(ip)
		});

		expect(response.status()).toBe(400);
		const body = await response.json();
		expect(body).toHaveProperty('error');
	});

	test('returns 400 when both fields are missing', async ({ request }) => {
		const ip = nextTestIp();
		const response = await request.post('/api/login', {
			data: {},
			headers: loginHeaders(ip)
		});

		expect(response.status()).toBe(400);
		const body = await response.json();
		expect(body).toHaveProperty('error');
	});

	test('returns 400 when username is not a string', async ({ request }) => {
		const ip = nextTestIp();
		const response = await request.post('/api/login', {
			data: { username: 123, password: STAFF_PASSWORD },
			headers: loginHeaders(ip)
		});

		expect(response.status()).toBe(400);
	});

	test('returns 400 when password is not a string', async ({ request }) => {
		const ip = nextTestIp();
		const response = await request.post('/api/login', {
			data: { username: STAFF_EMAIL, password: true },
			headers: loginHeaders(ip)
		});

		expect(response.status()).toBe(400);
	});
});

/* ------------------------------------------------------------------ */
/*  Session                                                            */
/* ------------------------------------------------------------------ */

test.describe('GET /api/session', () => {
	test('returns user info with a valid auth_token cookie', async ({ request }) => {
		const ip = nextTestIp();
		// First log in to get a valid token.
		const login = await request.post('/api/login', {
			data: { username: STAFF_EMAIL, password: STAFF_PASSWORD },
			headers: loginHeaders(ip)
		});
		expect(login.status()).toBe(200);

		// The session endpoint should pick up the cookie automatically.
		const response = await request.get('/api/session');

		expect(response.status()).toBe(200);
		const body = await response.json();
		expect(body).toHaveProperty('user');
		expect(body.user.username).toBe(STAFF_EMAIL);
		expect(body.user.role).toBe('staff');
	});

	test('returns 401 without any cookie', async ({ browser }) => {
		// Create a fresh browser context with no storageState (no cookies).
		const context = await browser!.newContext();
		try {
			const response = await context.request.get('/api/session');
			expect(response.status()).toBe(401);
		} finally {
			await context.close();
		}
	});

	test('returns 401 with an invalid cookie value', async ({ page }) => {
		// Set a fake cookie on the page's browser context.
		const baseURL = test.info().config?.projects?.[0]?.use?.baseURL as string | undefined;
		await page.context()!.addCookies([
			{ name: 'auth_token', value: 'invalid.token.here', url: baseURL ?? '/' }
		]);

		const resp = await page.request.get('/api/session');
		expect(resp.status()).toBe(401);
	});
});

/* ------------------------------------------------------------------ */
/*  Logout                                                             */
/* ------------------------------------------------------------------ */

test.describe('POST /api/logout', () => {
	test('clears the auth_token cookie after login', async ({ request }) => {
		const ip = nextTestIp();
		// Log in first.
		const login = await request.post('/api/login', {
			data: { username: STAFF_EMAIL, password: STAFF_PASSWORD },
			headers: loginHeaders(ip)
		});
		expect(login.status()).toBe(200);

		// Verify the cookie was set (via Set-Cookie header).
		const tokenBefore = extractAuthToken(login);
		expect(tokenBefore).not.toBeNull();

		// Log out.
		const logout = await request.post('/api/logout');
		expect(logout.status()).toBe(200);
		expect(await logout.json()).toEqual({ success: true });

		// The Set-Cookie header should clear the token (empty value + past expiry).
		const setCookie = logout.headers()['set-cookie'];
		expect(setCookie).toContain('auth_token=');
		expect(setCookie).toContain('expires=Thu, 01 Jan 1970');
	});

	test('logout without prior login still returns 200', async ({ request }) => {
		const response = await request.post('/api/logout');
		expect(response.status()).toBe(200);
	});
});

/* ------------------------------------------------------------------ */
/*  Rate limiting                                                      */
/* ------------------------------------------------------------------ */

// Every rate-limit test owns one dedicated IP so its attempt budget starts
// empty; attempts within a single test deliberately share it (same client).
test.describe('Rate limiting on POST /api/login', () => {
	test('returns 429 after too many failed attempts from the same IP', async ({ request }) => {
		const ip = nextTestIp();
		const badPassword = 'rate-limited-wrong';

		// Send 6 failed attempts (limit is 5 per minute).
		for (let i = 0; i < 6; i++) {
			const resp = await request.post('/api/login', {
				data: { username: STAFF_EMAIL, password: badPassword },
				headers: loginHeaders(ip)
			});

			if (i < 5) {
				expect(resp.status()).toBe(401);
			} else {
				expect(resp.status()).toBe(429);
				const body = await resp.json();
				expect(body).toHaveProperty('error');
			}
		}
	});

	test('successful login clears the rate-limit counter', async ({ request }) => {
		const ip = nextTestIp();
		// Four failed attempts (the limit is 5, so a valid attempt is still allowed).
		for (let i = 0; i < 4; i++) {
			const resp = await request.post('/api/login', {
				data: { username: STAFF_EMAIL, password: 'wrong' },
				headers: loginHeaders(ip)
			});
			expect(resp.status()).toBe(401);
		}

		// Log in with the correct password — this clears the counter.
		const login = await request.post('/api/login', {
			data: { username: STAFF_EMAIL, password: STAFF_PASSWORD },
			headers: loginHeaders(ip)
		});
		expect(login.status()).toBe(200);

		// Without the reset, the very next attempt would already be at the
		// cumulative 5-limit; a fresh budget of five failures must be available.
		for (let i = 0; i < 5; i++) {
			const resp = await request.post('/api/login', {
				data: { username: STAFF_EMAIL, password: 'wrong' },
				headers: loginHeaders(ip)
			});
			expect(resp.status()).toBe(401);
		}

		// The sixth failure after the clear gets blocked again.
		const blocked = await request.post('/api/login', {
			data: { username: STAFF_EMAIL, password: 'wrong' },
			headers: loginHeaders(ip)
		});
		expect(blocked.status()).toBe(429);
	});
});
