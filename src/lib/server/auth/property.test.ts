/**
 * Property-based tests for the JWT authentication module.
 *
 * Covers the correctness properties declared in
 * `.kiro/specs/jwt-auth-replacement/design.md` (Properties 1–12). Each test
 * asserts an invariant that must hold for *any* valid execution, not just
 * hand-picked examples.
 *
 * Run with `pnpm test:unit`.
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createToken, verifyToken } from './jwt.js';
import {
	setAuthCookie,
	clearAuthCookie,
	getAuthCookie,
	authenticate,
	handleJwtSession,
	validateAuthEnv
} from './index.js';
import { recordFailedAttempt, MAX_ATTEMPTS } from './rate-limit.js';
import { load as protectedLayoutLoad } from '../../../routes/(app)/+layout.server.js';

/* ------------------------------------------------------------------ */
/*  Generators and helpers                                             */
/* ------------------------------------------------------------------ */

/** Arbitrary secret: long enough to pass AUTH_SECRET validation. */
const secretArb = fc
	.string({ minLength: 32, maxLength: 64 })
	.filter((s) => !/\s/.test(s));

/** Arbitrary credential strings without whitespace. */
const passwordArb = fc
	.stringMatching(/^[!-~](.*?[!-~])?$/)
	.filter((s) => s.length >= 8 && s.length <= 72 && !/\s/.test(s));

/** Arbitrary valid usernames (the schema requires an email). */
const usernameArb = fc
	.stringMatching(/^[a-zA-Z0-9]{6,40}$/)
	.map((local) => `${local}@example.test`);

/** Cookie header carrying auth_token plus unrelated filler cookies. */
function cookieHeader(token: string): string {
	return `other=x; auth_token=${token}; lang=es`;
}

/** Response-like double collecting Set-Cookie values. */
function cookieRecorder(): Response & { cookies: string[] } {
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

/** A valid env triple matching the auth env schema. */
function validEnv(username: string, password: string, cost = 10): Record<string, string> {
	return {
		AUTH_SECRET: '0123456789abcdef0123456789abcdef-test-key',
		AUTH_USERNAME: username,
		AUTH_PASSWORD_HASH: bcrypt.hashSync(password, cost)
	};
}

/** Monotonic counter so rate-limit keys never repeat between generations. */
let clientIpCounter = 0;

/** Event double accepted by the protected layout load. */
type LayoutEvent = Parameters<typeof protectedLayoutLoad>[0];

/* ------------------------------------------------------------------ */
/*  Property 5: Token expiration consistency                           */
/* ------------------------------------------------------------------ */

describe('Property 5: Token expiration consistency', () => {
	it('every issued token expires exactly 7 days after issuing', async () => {
		await fc.assert(
			fc.asyncProperty(usernameArb, secretArb, async (username, secret) => {
				const token = createToken(username, secret);
				const payload = verifyToken(token, secret);

				expect(payload).not.toBeNull();
				expect(payload!.exp - payload!.iat).toBe(604800);
			}),
			{ numRuns: 60 }
		);
	});
});

/* ------------------------------------------------------------------ */
/*  Property 1: Session validation                                     */
/* ------------------------------------------------------------------ */

describe('Property 1: Session validation', () => {
	it('any unexpired token signed with the correct secret produces the right session', async () => {
		await fc.assert(
			fc.asyncProperty(usernameArb, secretArb, async (username, secret) => {
				const token = createToken(username, secret);
				const session = handleJwtSession(cookieHeader(token), secret);

				expect(session).not.toBeNull();
				expect(session!.user.username).toBe(username);
				expect(session!.user.role).toBe('staff');
				expect(session!.expiresAt.getTime()).toBeGreaterThan(Date.now());
			}),
			{ numRuns: 40 }
		);
	});
});

/* ------------------------------------------------------------------ */
/*  Property 2: Expired token rejection                                */
/* ------------------------------------------------------------------ */

describe('Property 2: Expired token rejection', () => {
	it('any token with an expiration in the past yields no session', async () => {
		await fc.assert(
			fc.asyncProperty(usernameArb, secretArb, fc.integer({ min: 1, max: 100_000 }), async (username, secret, ageSeconds) => {
				const iat = Math.floor(Date.now() / 1000) - ageSeconds;
				const payload = { sub: 'staff', username, role: 'staff', iat, exp: iat - 1 };
				const token = jwt.sign(payload, secret, { algorithm: 'HS256' });

				expect(verifyToken(token, secret)).toBeNull();
				expect(handleJwtSession(cookieHeader(token), secret)).toBeNull();
			}),
			{ numRuns: 30 }
		);
	});
});

/* ------------------------------------------------------------------ */
/*  Property 3: Invalid token rejection                                */
/* ------------------------------------------------------------------ */

describe('Property 3: Invalid token rejection', () => {
	it('any tampered or wrongly-signed token yields no session', async () => {
		await fc.assert(
			fc.asyncProperty(usernameArb, secretArb, fc.constantFrom('A', 'a', '7', '!'), async (username, secret, replacement) => {
				// Wrong secret.
				const wrongToken = createToken(username, `${secret}X`);
				expect(verifyToken(wrongToken, secret)).toBeNull();
				expect(handleJwtSession(cookieHeader(wrongToken), secret)).toBeNull();

				// Tampered body: replace some byte mid-token.
				const valid = createToken(username, secret);
				const mid = Math.floor(valid.length / 2);
				const tampered =
					valid.slice(0, mid) + (valid[mid] === replacement ? 'RrR' : replacement) + valid.slice(mid + 1);

				if (tampered !== valid) {
					expect(verifyToken(tampered, secret)).toBeNull();
					expect(handleJwtSession(cookieHeader(tampered), secret)).toBeNull();
				}
			}),
			{ numRuns: 30 }
		);
	});
});

/* ------------------------------------------------------------------ */
/*  Property 4: Cookie HttpOnly flag                                   */
/* ------------------------------------------------------------------ */

describe('Property 4: Cookie HttpOnly flag', () => {
	it('the auth_token cookie is always HttpOnly, whatever the token', async () => {
		await fc.assert(
			fc.asyncProperty(usernameArb, secretArb, async (username, secret) => {
				const token = createToken(username, secret);
				const response = cookieRecorder();
				setAuthCookie(response, token);

				expect(response.cookies).toHaveLength(1);
				expect(response.cookies[0]).toContain('HttpOnly');
				expect(response.cookies[0]).toContain(`auth_token=${token}`);
			}),
			{ numRuns: 30 }
		);
	});
});

/* ------------------------------------------------------------------ */
/*  Property 6: Protected route access control                         */
/* ------------------------------------------------------------------ */

describe('Property 6: Protected route access control', () => {
	it('a request without a session is redirected to /login with 303', async () => {
		await fc.assert(
			fc.asyncProperty(fc.constant(null), async () => {
				const event = { locals: {} } as unknown as LayoutEvent;
				// redirect() throws synchronously from the load function.
				let thrown: unknown;
				try {
					protectedLayoutLoad(event);
				} catch (error) {
					thrown = error;
				}
				expect(thrown).toMatchObject({ status: 303, location: '/login' });
			}),
			{ numRuns: 10 }
		);
	});
});

/* ------------------------------------------------------------------ */
/*  Property 7: Logout cookie clearing                                 */
/* ------------------------------------------------------------------ */

describe('Property 7: Logout cookie clearing', () => {
	it('after logout, a follow-up request carries no valid session', async () => {
		await fc.assert(
			fc.asyncProperty(usernameArb, secretArb, async (username, secret) => {
				const token = createToken(username, secret);

				// The session is valid before logout.
				expect(handleJwtSession(cookieHeader(token), secret)).not.toBeNull();

				const response = cookieRecorder();
				clearAuthCookie(response);
				const clearedValue = response.cookies[0]
					.split(';')[0]
					.split('=')[1] ?? '';

				// Cleared cookie: empty value → no token → no session.
				expect(getAuthCookie(`auth_token=${clearedValue}`)).toBeNull();
				expect(handleJwtSession(`auth_token=${clearedValue}`, secret)).toBeNull();
			}),
			{ numRuns: 30 }
		);
	});
});

/* ------------------------------------------------------------------ */
/*  Property 8: Rate limit enforcement                                 */
/* ------------------------------------------------------------------ */

describe('Property 8: Rate limit enforcement', () => {
	it('exactly MAX_ATTEMPTS failures pass the window; every later one is blocked', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.integer({ min: 1, max: 8 }),
				fc.integer({ min: 0, max: 254 }),
				fc.integer({ min: 0, max: 254 }),
				async (extraAttempts, a, b) => {
					// A unique key per generation so each run starts with a fresh window.
					clientIpCounter += 1;
					const ip = `198.51.100.${a}.${b}.${clientIpCounter}`;
					const request = new Request('http://localhost/api/login', {
						headers: { 'x-forwarded-for': ip }
					});

					const limited: boolean[] = [];
					for (let i = 0; i < MAX_ATTEMPTS + extraAttempts; i++) {
						limited.push(recordFailedAttempt(request));
					}

					expect(limited.slice(0, MAX_ATTEMPTS)).toStrictEqual(
						new Array(MAX_ATTEMPTS).fill(false)
					);
					expect(limited.slice(MAX_ATTEMPTS)).toStrictEqual(
						new Array(extraAttempts).fill(true)
					);
				}
			),
			{ numRuns: 25 }
		);
	});
});

/* ------------------------------------------------------------------ */
/*  Property 9: Environment variable requirements                      */
/* ------------------------------------------------------------------ */

describe('Property 9: Environment variable requirements', () => {
	it('a missing required variable always fails validation with a Spanish error', async () => {
		await fc.assert(
			fc.asyncProperty(
				usernameArb,
				passwordArb,
				fc.constantFrom('AUTH_SECRET', 'AUTH_USERNAME', 'AUTH_PASSWORD_HASH'),
				async (username, password, missing) => {
				const env = validEnv(username, password);
				delete env[missing];

				expect(() => validateAuthEnv(env)).toThrowError('Falta o es inválido');
				await expect(authenticate(username, password, env)).rejects.toThrowError(
					/Falta o es inválido/
				);
			}
		),
			{ numRuns: 30 }
		);
	});
});

/* ------------------------------------------------------------------ */
/*  Property 10: Password hash validation                              */
/* ------------------------------------------------------------------ */

describe('Property 10: Password hash validation', () => {
	it('a token is issued only when bcrypt verifies the provided password against the stored hash', async () => {
		await fc.assert(
			fc.asyncProperty(usernameArb, passwordArb, passwordArb, async (username, good, bad) => {
				const wrong = bad === good ? `${bad}x` : bad;
				const env = validEnv(username, good, 4);

				// Correct password → token (whose payload round-trips).
				const token = await authenticate(username, good, env);
				expect(verifyToken(token, env.AUTH_SECRET)?.username).toBe(username);

				// Wrong password → same Spanish message, no token.
				await expect(authenticate(username, wrong, env)).rejects.toThrowError(
					'Correo o contraseña incorrectos.'
				);
			}),
			{ numRuns: 12 }
		);
	}, 30000);
});

/* ------------------------------------------------------------------ */
/*  Property 11: Session persistence                                   */
/* ------------------------------------------------------------------ */
describe('Property 11: Session persistence', () => {
	it('repeated requests within the session lifetime keep the exact same session', async () => {
		await fc.assert(
			fc.asyncProperty(usernameArb, secretArb, fc.integer({ min: 2, max: 6 }), async (username, secret, times) => {
				const header = cookieHeader(createToken(username, secret));
				const first = handleJwtSession(header, secret);
				expect(first).not.toBeNull();

				for (let i = 1; i < times; i++) {
					const again = handleJwtSession(header, secret);
					expect(again!.user).toEqual(first!.user);
					expect(again!.expiresAt).toEqual(first!.expiresAt);
				}
			}),
			{ numRuns: 30 }
		);
	});
});

/* ------------------------------------------------------------------ */
/*  Property 12: Spanish error messages                                */
/* ------------------------------------------------------------------ */

describe('Property 12: Spanish error messages', () => {
	it('any wrong credential is rejected with the canonical Spanish message', async () => {
		await fc.assert(
			fc.asyncProperty(usernameArb, passwordArb, passwordArb, fc.boolean(), async (username, good, bad, wrongUser) => {
				const env = validEnv(username, good, 4);
				// Both wrong variants stay well-formed (valid email, valid password)
				// so env validation passes and credential checking is what rejects.
				const otherUser = wrongUser ? `other.${username}` : username;
				const otherPassword = bad === good ? `${bad}y` : bad;
				const expected = 'Correo o contraseña incorrectos.';

				if (wrongUser) {
					await expect(authenticate(otherUser, good, env)).rejects.toThrowError(expected);
				} else {
					await expect(authenticate(username, otherPassword, env)).rejects.toThrowError(expected);
				}
			}),
			{ numRuns: 12 }
		);
	}, 30000);
});
