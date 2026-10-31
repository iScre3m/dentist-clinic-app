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

/**
 * Argentina mobile numbers carry a 9 after +54, and people type their number
 * without it ("11 5555-0001"). Retry with the 9 before rejecting. Every
 * candidate still has to pass the library's validation and mobile check for
 * the chosen country, so no rule is applied to other countries.
 */
function candidates(raw: string, country: CountryCode): string[] {
	if (country !== 'AR') return [raw];

	const seen = new Set<string>([raw]);
	const compact = raw.replace(/[\s().-]/g, '');
	const national = compact.replace(/^\+?54/, '').replace(/^0+/, '');

	if (national) {
		seen.add(`9${national}`);
		if (compact.startsWith('+54')) seen.add(`+549${national}`);
	}

	return [...seen];
}

export function normalizeMobile(raw: string, country: CountryCode): PhoneCheck {
	let sawValidNumber = false;

	for (const candidate of candidates(raw.trim(), country)) {
		const parsed = parse(candidate, country);
		if (!parsed || !parsed.isValid()) continue;

		sawValidNumber = true;
		const type = parsed.getType();
		if (type && MOBILE_TYPES.has(type)) return { ok: true, e164: parsed.number };
	}

	return { ok: false, reason: sawValidNumber ? 'not-mobile' : 'invalid' };
}
