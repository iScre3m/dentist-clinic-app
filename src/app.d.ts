import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '#lib/server/db/schema.js';

declare global {
	namespace App {
		interface Locals {
			db: DrizzleD1Database<typeof schema>;
			session: {
				user: {
					id: string;
					username: string;
					role: 'staff';
				};
				expiresAt: Date;
			} | null;
		}
	}
	interface Env {
		AUTH_SECRET: string;
		AUTH_USERNAME: string;
		AUTH_PASSWORD_HASH: string;
	}
}

export {};
