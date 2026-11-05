/*
 * Change the staff account's username and/or password.
 *
 * Staff credentials live in `.env` (AUTH_USERNAME, AUTH_PASSWORD_HASH); there is
 * no user table in the database. This script rewrites those variables in `.env`
 * with a freshly bcrypt-hashed password.
 *
 * Examples:
 *   pnpm staff:update -- --password NuevaContraseña2026
 *       → changes AUTH_PASSWORD_HASH in the local .env
 *
 *   pnpm staff:update -- --email laura@consultorio.com --password NuevaContraseña2026
 *       → changes AUTH_USERNAME and AUTH_PASSWORD_HASH in the local .env
 *
 * Flags:
 *   --email <e>     new login username (default: AUTH_USERNAME from .env)
 *   --password <p>  new password (default: SEED_STAFF_PASSWORD from .env)
 */

import { parseArgs } from 'node:util';
import * as fs from 'node:fs';

try {
	process.loadEnvFile('.env');
} catch {
	// No .env file; defaults apply.
}

const { values } = parseArgs({
	options: {
		email: { type: 'string' },
		password: { type: 'string' }
	}
});

const email = values.email ?? process.env.AUTH_USERNAME;
const password = values.password ?? process.env.SEED_STAFF_PASSWORD;
if (!email) {
	console.error('Falta --email (o AUTH_USERNAME en .env).');
	process.exit(1);
}
if (!password) {
	console.error('Falta --password (o SEED_STAFF_PASSWORD en .env).');
	process.exit(1);
}

const { hashSync } = await import('bcryptjs');
const hashed = hashSync(password, 10);

// wrangler's .env loader expands `$…` in unquoted values, which would corrupt
// the bcrypt hash (`$2b$10$…`). Backslash-escape the dollars so the value
// survives: wrangler strips the backslashes, dotenv keeps the literal value.
const escHashed = hashed.replaceAll('$', '\\$');

const envPath = '.env';
let contents = '';
if (fs.existsSync(envPath)) {
	contents = fs.readFileSync(envPath, 'utf8');
}

const setVar = (text: string, key: string, value: string): string => {
	const regex = new RegExp(`^(${key})=.*$`, 'm');
	if (regex.test(text)) {
		// A function replacement is essential: bcrypt hashes contain `$…`
		// sequences that `String.replace` would otherwise interpret as
		// capture-group patterns and corrupt the written value.
		return text.replace(regex, (_match, name: string) => `${name}=${value}`);
	}
	return text + (text.endsWith('\n') ? '' : '\n') + `${key}=${value}\n`;
};

let updated = setVar(contents, 'AUTH_USERNAME', email);
updated = setVar(updated, 'AUTH_PASSWORD_HASH', escHashed);
fs.writeFileSync(envPath, updated, 'utf8');

console.log(`Actualizado .env: AUTH_USERNAME=${email}`);
console.log(`AUTH_PASSWORD_HASH regenerateado (bcrypt, 10 rondas).`);
console.log('Reinicie la aplicación para que surtan efecto las nuevas credenciales.');
