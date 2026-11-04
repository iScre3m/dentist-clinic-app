import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { account, session, user, verification } from './db/schema.js';

export function createAuth(db: Parameters<typeof drizzleAdapter>[0], secret: string, baseURL: string) {
	return betterAuth({
		database: drizzleAdapter(db, {
			provider: 'sqlite',
			schema: { user, session, account, verification }
		}),
		secret,
		baseURL,
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
}
