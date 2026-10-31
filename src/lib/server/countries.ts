import { getCountries } from 'libphonenumber-js/max';

const regionNames = new Intl.DisplayNames(['es-AR'], { type: 'region' });

/** Countries the practice works with: North America, Latin America, Spain. */
const ALLOWED_CODES = new Set([
	'AR', // Argentina
	'BO', // Bolivia
	'BR', // Brazil
	'CA', // Canada
	'US', // United States
	'CL', // Chile
	'CO', // Colombia
	'CR', // Costa Rica
	'DO', // Dominican Republic
	'EC', // Ecuador
	'ES', // Spain
	'GT', // Guatemala
	'HN', // Honduras
	'MX', // Mexico
	'PA', // Panama
	'PE', // Peru
	'PY', // Paraguay
	'SV', // El Salvador
	'UY', // Uruguay
	'VE' // Venezuela
]);

/** Country options for phone entry, sorted for humans, not by code. */
export const countries = getCountries()
	.filter((code) => ALLOWED_CODES.has(code))
	.map((code) => ({ code, name: regionNames.of(code) ?? code }))
	.sort((a, b) => a.name.localeCompare(b.name, 'es-AR'));
