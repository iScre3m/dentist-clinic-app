import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit } from './rate-limit.ts';

describe('checkRateLimit', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('allows up to the limit inside the window', () => {
		const key = 'test:allow';
		expect(checkRateLimit(key, 3, 60_000)).toBe(true);
		expect(checkRateLimit(key, 3, 60_000)).toBe(true);
		expect(checkRateLimit(key, 3, 60_000)).toBe(true);
		expect(checkRateLimit(key, 3, 60_000)).toBe(false);
	});

	it('starts a new window after it expires', () => {
		const key = 'test:expire';
		expect(checkRateLimit(key, 1, 60_000)).toBe(true);
		expect(checkRateLimit(key, 1, 60_000)).toBe(false);

		vi.setSystemTime(new Date('2026-01-01T12:01:01Z'));
		expect(checkRateLimit(key, 1, 60_000)).toBe(true);
	});

	it('tracks each key separately', () => {
		expect(checkRateLimit('test:a', 1, 60_000)).toBe(true);
		expect(checkRateLimit('test:b', 1, 60_000)).toBe(true);
	});
});
