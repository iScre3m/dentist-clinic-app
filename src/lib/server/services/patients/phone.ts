import {
	getCountries,
	parsePhoneNumberFromString,
	type CountryCode,
	type PhoneNumber
} from 'libphonenumber-js/max';

export type PhoneFailure = 'invalid' | 'not-mobile';
export type PhoneCheck = { ok: true; e164: string } | { ok: false; reason: PhoneFailure };

/** Numbers the library cannot separate into mobile/fixed are accepted. */
const MOBILE_TYPES = new Set(['MOBILE', 'FIXED_LINE_OR_MOBILE']);

const countryCodes = new Set<string>(getCountries());

export function isCountryCode(value: string): value is CountryCode {
	return countryCodes.has(value);
}

function parse(raw: string, country: CountryCode): PhoneNumber | undefined {
	try {
		return parsePhoneNumberFromString(raw, country) ?? undefined;
	} catch {
		return undefined;
	}
}

export function normalizeMobile(raw: string, country: CountryCode): PhoneCheck {
	const parsed = parse(raw.trim(), country);
	if (!parsed || !parsed.isValid()) {
		return { ok: false, reason: 'invalid' };
	}

	const type = parsed.getType();
	if (type && MOBILE_TYPES.has(type)) {
		return { ok: true, e164: parsed.number };
	}

	return { ok: false, reason: 'not-mobile' };
}
