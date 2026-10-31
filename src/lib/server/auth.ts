import './load-env.ts';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';
import { account, session, user, verification } from './db/schema';

const secret = process.env.BETTER_AUTH_SECRET;

if (!secret && process.env.NODE_ENV === 'production') {
	throw new Error('Falta BETTER_AUTH_SECRET.');
}

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'sqlite',
		schema: { user, session, account, verification }
	}),
	secret: secret ?? 'dev-only-secret-change-me',
	baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:5173',
	emailAndPassword: {
		enabled: true
	},
	session: {
		expiresIn: 60 * 60 * 24 * 7
	},
	rateLimit: {
		enabled: true,
		window: 60,
		max: 10
	}
});
