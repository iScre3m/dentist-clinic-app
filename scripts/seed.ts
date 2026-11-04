import { resolve } from 'node:path';

try {
	process.loadEnvFile('.env');
} catch {
	// No .env file; defaults apply.
}

if (process.env.NODE_ENV === 'production') {
	console.error('db:seed no se ejecuta con NODE_ENV=production.');
	process.exit(1);
}

const { db } = await import('../src/lib/server/db/local');
const { seedDatabase } = await import('../src/lib/server/db/seed');

const result = await seedDatabase(db, {
	staffName: process.env.SEED_STAFF_NAME ?? 'Dra. Laura',
	staffEmail: process.env.SEED_STAFF_EMAIL ?? 'staff@example.com',
	staffPassword: process.env.SEED_STAFF_PASSWORD ?? 'change-me-too'
});

console.log(`Listo. Personal: ${result.staffEmail} (${resolve(process.env.DATABASE_PATH ?? './local.db')})`);
