import { parsePhoneNumberFromString, type PhoneNumber } from 'libphonenumber-js/max';

export type PhoneFailure = 'invalid' | 'not-mobile';
export type PhoneCheck = { ok: true; e164: string } | { ok: false; reason: PhoneFailure };

/** The practice only works with Argentine mobile numbers. */
const COUNTRY = 'AR' as const;

/** Numbers the library cannot separate into mobile/fixed are accepted. */
const MOBILE_TYPES = new Set(['MOBILE', 'FIXED_LINE_OR_MOBILE']);

function parse(raw: string): PhoneNumber | undefined {
	try {
		return parsePhoneNumberFromString(raw, COUNTRY) ?? undefined;
	} catch {
		return undefined;
	}
}

export function normalizeMobile(raw: string): PhoneCheck {
	const parsed = parse(raw.trim());

	// The default region only applies when the input has no country code, so a
	// number typed with a foreign prefix would otherwise parse as valid.
	if (!parsed || !parsed.isValid() || parsed.country !== COUNTRY) {
		return { ok: false, reason: 'invalid' };
	}

	const type = parsed.getType();
	if (type && MOBILE_TYPES.has(type)) {
		return { ok: true, e164: parsed.number };
	}

	return { ok: false, reason: 'not-mobile' };
}
