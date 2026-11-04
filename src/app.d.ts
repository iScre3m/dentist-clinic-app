import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { createAuth } from '#lib/server/auth.js';
import type * as schema from '#lib/server/db/schema.js';

declare global {
	namespace App {
		interface Locals {
			db: DrizzleD1Database<typeof schema>;
			auth: ReturnType<typeof createAuth>;
			session: Awaited<ReturnType<ReturnType<typeof createAuth>['api']['getSession']>> | null;
		}
	}
	interface Env {
		BETTER_AUTH_SECRET: string;
	}
}

export {};