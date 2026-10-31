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
		password: { type: 'string' }
	}
});

if (!values.email) {
	console.error('Falta --email (cuenta actual).');
	process.exit(1);
}
if (!values.name && !values['new-email'] && !values.password) {
	console.error('Indicá al menos --name, --new-email o --password.');
	process.exit(1);
}

const { db } = await import('../src/lib/server/db');
const { user, account } = await import('../src/lib/server/db/schema');
const { eq } = await import('drizzle-orm');

const existing = await db.select().from(user).where(eq(user.email, values.email)).limit(1);
if (existing.length === 0) {
	console.error(`No existe el usuario ${values.email}.`);
	process.exit(1);
}
const u = existing[0];

const updates: Record<string, unknown> = { updatedAt: new Date() };
if (values.name) updates.name = values.name;
if (values['new-email']) updates.email = values['new-email'];

if (Object.keys(updates).length > 1) {
	await db.update(user).set(updates).where(eq(user.id, u.id));
}

if (values.password) {
	const { hashPassword } = await import('@better-auth/utils/password' as any);
	const hashed = await hashPassword(values.password);
	await db
		.update(account)
		.set({ password: hashed, updatedAt: new Date() })
		.where(eq(account.userId, u.id));
}

console.log(`Actualizado: ${values['new-email'] ?? values.email}`);
