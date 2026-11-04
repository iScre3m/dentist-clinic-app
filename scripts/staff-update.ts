/*
 * Change a staff account's name, email or password.
 *
 * The credentials come from `.env` so you normally only edit, once:
 *
 *   SEED_STAFF_EMAIL=el-email-actual@dominio.com
 *   SEED_STAFF_PASSWORD=la-nueva-contraseña
 *
 * Examples:
 *   pnpm staff:update -- --password NuevaContraseña2026
 *       → changes the password of whichever account SEED_STAFF_EMAIL points to,
 *         in the LOCAL database (.env DATABASE_PATH).
 *
 *   pnpm staff:update -- --password NuevaContraseña2026 --remote
 *       → same change, but on the REMOTE Cloudflare D1 database
 *         (needs CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN in .env).
 *
 *   pnpm staff:update -- --email staff@example.com --new-email laura@consultorio.com
 *   pnpm staff:update -- --email staff@example.com --name 'Dra. Laura' --password NuevaContraseña2026
 *
 * Flags:
 *   --email <email>     account to update (default: SEED_STAFF_EMAIL from .env)
 *   --name <name>       new display name
 *   --new-email <e>     new login email
 *   --password <p>      new password
 *   --remote            update the remote D1 database instead of the local file
 */

import { parseArgs } from 'node:util';

try {
	process.loadEnvFile('.env');
} catch {
	// No .env file; defaults apply.
}

const { values } = parseArgs({
	options: {
		email: { type: 'string' },
		name: { type: 'string' },
		'new-email': { type: 'string' },
		password: { type: 'string' },
		remote: { type: 'boolean' }
	}
});

const email = values.email ?? process.env.SEED_STAFF_EMAIL;
const password = values.password ?? process.env.SEED_STAFF_PASSWORD;
if (!email) {
	console.error('Falta --email (o SEED_STAFF_EMAIL en .env).');
	process.exit(1);
}
if (!values.name && !values['new-email'] && !password) {
	console.error(
		'Indique al menos --name, --new-email o [--password | SEED_STAFF_PASSWORD en .env].'
	);
	process.exit(1);
}

const scope = values.remote ? 'remota (Cloudflare D1)' : 'local';
console.log(`Actualizando cuenta en la base ${scope}: ${email}`);
if (values.remote) {
	const { createRemoteD1Db } = await import('./d1-remote.ts');
	const { user, account } = await import('../src/lib/server/db/schema.ts');
	const { eq } = await import('drizzle-orm');
	const db = createRemoteD1Db();
	const existing = await db.select().from(user).where(eq(user.email, email)).limit(1);
	if (existing.length === 0) {
		console.error(`No existe el usuario ${email} en la base remota.`);
		process.exit(1);
	}
	const u = existing[0];
	if (values.name || values['new-email']) {
		await db
			.update(user)
			.set({
				name: values.name ?? u.name,
				email: values['new-email'] ?? u.email,
				updatedAt: new Date()
			})
			.where(eq(user.id, u.id));
	}
	if (password) {
		const { hashPassword } = await import('better-auth/crypto');
		const hashed = await hashPassword(password);
		await db
			.update(account)
			.set({ password: hashed, updatedAt: new Date() })
			.where(eq(account.userId, u.id));
	}
	console.log(`Actualizado (remota): ${values['new-email'] ?? email}`);
	process.exit(0);
}

const { db } = await import('../src/lib/server/db/local');
const { user, account } = await import('../src/lib/server/db/schema');
const { eq } = await import('drizzle-orm');

const existing = await db.select().from(user).where(eq(user.email, email)).limit(1);
if (existing.length === 0) {
	console.error(`No existe el usuario ${email}.`);
	process.exit(1);
}
const u = existing[0];

const updates: Record<string, unknown> = { updatedAt: new Date() };
if (values.name) updates.name = values.name;
if (values['new-email']) updates.email = values['new-email'];

if (Object.keys(updates).length > 1) {
	await db.update(user).set(updates).where(eq(user.id, u.id));
}

	if (password) {
		const { hashPassword } = await import('better-auth/crypto');
		const hashed = await hashPassword(password);
		await db
			.update(account)
			.set({ password: hashed, updatedAt: new Date() })
			.where(eq(account.userId, u.id));
	}

	console.log(`Actualizado: ${values['new-email'] ?? email}`);
