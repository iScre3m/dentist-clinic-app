import { env } from 'cloudflare:workers';
import { createAuth } from '#lib/server/auth.js';
import { createD1Database } from '#lib/server/db/d1.js';
import { installDb } from '#lib/server/db/index.js';

import type { Handle } from '@sveltejs/kit/hooks';
import { building } from '$app/env';

export const handle: Handle = async ({ event, resolve }) => {
	// 1. Fail fast at runtime if the secret is missing (skip during build).
	if (!building && !env.BETTER_AUTH_SECRET) {
		throw new Error('Falta BETTER_AUTH_SECRET.');
	}

	// 2. D1 binding → Drizzle connection, installed isolate-wide so every
	//    service that imports `db` talks to the same handle
	const db = createD1Database(env.DB);
	installDb(db);

	// 3. Better Auth instance (factory, per request)
	const auth = createAuth(db, env.BETTER_AUTH_SECRET, event.url.origin);

	// 4. Session lookup
	event.locals.session = await auth.api.getSession({
		headers: event.request.headers
	});
	event.locals.auth = auth;
	event.locals.db = db;

	// 5. Hand off to SvelteKit
	return resolve(event);
};