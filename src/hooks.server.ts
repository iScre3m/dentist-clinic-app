import { env } from 'cloudflare:workers';
import { createD1Database } from '#lib/server/db/d1.js';
import { installDb } from '#lib/server/db/index.js';
import { handleJwtSession } from '#lib/server/auth/index.js';

import type { Handle } from '@sveltejs/kit/hooks';
import { building } from '$app/env';

export const handle: Handle = async ({ event, resolve }) => {
	if (!building && !(env as unknown as Record<string, string | undefined>).AUTH_SECRET) {
		throw new Error('Falta AUTH_SECRET.');
	}

	const db = createD1Database(env.DB);
	installDb(db);

	const cookieHeader = event.request.headers.get('cookie');
	const secret = (env as unknown as Record<string, string | undefined>).AUTH_SECRET || process.env.AUTH_SECRET;
	event.locals.session = secret ? handleJwtSession(cookieHeader, secret) : null;
	event.locals.db = db;

	return resolve(event);
};
