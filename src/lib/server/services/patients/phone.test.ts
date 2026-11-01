import { describe, expect, it } from 'vitest';
import { normalizeMobile } from './phone.ts';

describe('normalizeMobile', () => {
	it('accepts an already normalized Argentine mobile number', () => {
		expect(normalizeMobile('+54 9 11 5555-0001')).toEqual({
			ok: true,
			e164: '+5491155550001'
		});
		expect(normalizeMobile('5491155550001')).toEqual({ ok: true, e164: '+5491155550001' });
	});

	it('accepts the number as the patient dials it', () => {
		expect(normalizeMobile('11 15 5555 0001')).toEqual({ ok: true, e164: '+5491155550001' });
		expect(normalizeMobile('011 15 5555-0001')).toEqual({ ok: true, e164: '+5491155550001' });
	});

	it('rejects an Argentine number missing the mobile 9 as a landline', () => {
		expect(normalizeMobile('11 5555-0001')).toEqual({ ok: false, reason: 'not-mobile' });
		expect(normalizeMobile('011 5555-0001')).toEqual({ ok: false, reason: 'not-mobile' });
		expect(normalizeMobile('+54 11 5555-0001')).toEqual({ ok: false, reason: 'not-mobile' });
	});

	it('rejects numbers from other countries', () => {
		expect(normalizeMobile('+52 55 1234 5678')).toEqual({ ok: false, reason: 'invalid' });
		expect(normalizeMobile('+1 650 253 0000')).toEqual({ ok: false, reason: 'invalid' });
		expect(normalizeMobile('+44 7911 123456')).toEqual({ ok: false, reason: 'invalid' });
	});

	it('rejects numbers that are not valid Argentine mobiles', () => {
		expect(normalizeMobile('12345')).toEqual({ ok: false, reason: 'invalid' });
		expect(normalizeMobile('')).toEqual({ ok: false, reason: 'invalid' });
	});
});
