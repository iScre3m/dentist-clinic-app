import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { handleJwtSession } from '#lib/server/auth/index.js';
import { env } from 'cloudflare:workers';

export const GET: RequestHandler = async ({ request }) => {
	const secret = (env as unknown as Record<string, string | undefined>).AUTH_SECRET;

	if (!secret) {
		throw error(401, 'No autorizado');
	}

	const cookieHeader = request.headers.get('cookie');
	const session = handleJwtSession(cookieHeader, secret);

	if (!session) {
		throw error(401, 'No autorizado');
	}

	return json({ user: session.user });
};
