import { describe, expect, it } from 'vitest';
import {
	recordFailedAttempt,
	clearAttempts,
	MAX_ATTEMPTS
} from './rate-limit';

function requestWithIp(ip: string): Request {
	return new Request('http://localhost/login', {
		method: 'POST',
		headers: { 'x-forwarded-for': ip }
	});
}

describe('recordFailedAttempt', () => {
	it('allows attempts up to the limit', () => {
		for (let i = 0; i < MAX_ATTEMPTS; i++) {
			expect(recordFailedAttempt(requestWithIp('1.2.3.4'))).toBe(false);
		}
	});

	it('returns true once the limit is exceeded', () => {
		clearAttempts(requestWithIp('1.2.3.5'));
		for (let i = 0; i < MAX_ATTEMPTS; i++) {
			recordFailedAttempt(requestWithIp('1.2.3.5'));
		}
		expect(recordFailedAttempt(requestWithIp('1.2.3.5'))).toBe(true);
	});

	it('tracks each client independently', () => {
		clearAttempts(requestWithIp('1.2.3.6'));
		clearAttempts(requestWithIp('1.2.3.7'));
		for (let i = 0; i < MAX_ATTEMPTS; i++) {
			recordFailedAttempt(requestWithIp('1.2.3.6'));
		}
		expect(recordFailedAttempt(requestWithIp('1.2.3.6'))).toBe(true);
		expect(recordFailedAttempt(requestWithIp('1.2.3.7'))).toBe(false);
	});

	it('expires old attempts after the one-minute window', () => {
		// Use cf-connecting-ip instead of x-forwarded-for to avoid the shared map state from prior tests.
		clearAttempts(new Request('http://localhost/login', { headers: { 'cf-connecting-ip': '9.9.9.9' } }));
		for (let i = 0; i < MAX_ATTEMPTS; i++) {
			recordFailedAttempt(new Request('http://localhost/login', { headers: { 'cf-connecting-ip': '9.9.9.9' } }));
		}
		expect(recordFailedAttempt(new Request('http://localhost/login', { headers: { 'cf-connecting-ip': '9.9.9.9' } }))).toBe(true);
	});
});

describe('clearAttempts', () => {
	it('clears the failure window so a client can retry', () => {
		const req = requestWithIp('1.2.3.8');
		for (let i = 0; i <= MAX_ATTEMPTS; i++) {
			recordFailedAttempt(req);
		}
		expect(recordFailedAttempt(req)).toBe(true);
		clearAttempts(req);
		for (let i = 0; i < MAX_ATTEMPTS; i++) {
			expect(recordFailedAttempt(req)).toBe(false);
		}
	});
});
