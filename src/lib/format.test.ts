import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, localDateKey } from './format.ts';

describe('localDateKey', () => {
	it('returns the calendar date in the practice timezone, not UTC', () => {
		// 02:00 UTC on Jan 2 is already 23:00 on Jan 1 in Buenos Aires (UTC-3).
		expect(localDateKey(new Date('2026-01-02T02:00:00Z'))).toBe('2026-01-01');
	});

	it('keeps a daytime instant on the same date', () => {
		expect(localDateKey(new Date('2026-06-15T15:30:00Z'))).toBe('2026-06-15');
	});
});

describe('formatDate', () => {
	it('renders a placeholder when there is no date', () => {
		expect(formatDate(null)).toBe('—');
	});
});

describe('formatDateTime', () => {
	it('keeps all-day values on their local date without a time', () => {
		expect(formatDateTime(new Date('2026-03-10T00:00:00Z'), true)).not.toContain(':');
	});
});
