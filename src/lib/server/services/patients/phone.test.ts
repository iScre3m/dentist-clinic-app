import { describe, expect, it } from 'vitest';
import { isCountryCode, normalizeMobile } from './phone.ts';

describe('normalizeMobile', () => {
	it('adds the Argentine 9 to a national mobile number', () => {
		expect(normalizeMobile('11 5555-0001', 'AR')).toEqual({ ok: true, e164: '+5491155550001' });
	});

	it('handles the leading 0 people dial locally', () => {
		expect(normalizeMobile('011 5555-0001', 'AR')).toEqual({ ok: true, e164: '+5491155550001' });
	});

	it('fixes an international Argentine number missing the 9', () => {
		expect(normalizeMobile('+54 11 5555-0001', 'AR')).toEqual({
			ok: true,
			e164: '+5491155550001'
		});
	});

	it('accepts an already normalized Argentine number', () => {
		expect(normalizeMobile('+54 9 11 5555-0001', 'AR')).toEqual({
			ok: true,
			e164: '+5491155550001'
		});
		expect(normalizeMobile('5491155550001', 'AR')).toEqual({ ok: true, e164: '+5491155550001' });
	});

	it('normalizes a Mexican mobile number', () => {
		expect(normalizeMobile('55 1234 5678', 'MX')).toEqual({ ok: true, e164: '+525512345678' });
	});

	it('rejects the outdated Mexican 1 prefix', () => {
		expect(normalizeMobile('+52 1 55 1234 5678', 'MX')).toEqual({ ok: false, reason: 'invalid' });
	});

	it('accepts numbers whose type cannot be narrowed down', () => {
		expect(normalizeMobile('+1 650 253 0000', 'US')).toEqual({ ok: true, e164: '+16502530000' });
	});

	it('accepts a British mobile number', () => {
		expect(normalizeMobile('+44 7911 123456', 'GB')).toEqual({ ok: true, e164: '+447911123456' });
	});

	it('rejects a fixed line', () => {
		expect(normalizeMobile('+44 20 7946 0958', 'GB')).toEqual({ ok: false, reason: 'not-mobile' });
	});

	it('rejects numbers that are not valid for the country', () => {
		expect(normalizeMobile('12345', 'AR')).toEqual({ ok: false, reason: 'invalid' });
		expect(normalizeMobile('', 'AR')).toEqual({ ok: false, reason: 'invalid' });
	});
});

describe('isCountryCode', () => {
	it('accepts known countries only', () => {
		expect(isCountryCode('AR')).toBe(true);
		expect(isCountryCode('MX')).toBe(true);
		expect(isCountryCode('ZZ')).toBe(false);
		expect(isCountryCode('ar')).toBe(false);
	});
});
