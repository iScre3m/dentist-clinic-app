import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticate, setAuthCookie } from '#lib/server/auth/index.js';
import { recordFailedAttempt, clearAttempts } from '#lib/server/auth/rate-limit.js';
import { env } from 'cloudflare:workers';

export const POST: RequestHandler = async ({ request }) => {
	const limited = recordFailedAttempt(request);
	if (limited) {
		return json({ error: 'Demasiados intentos. Intentá de nuevo en un minuto.' }, { status: 429 });
	}

	try {
		const body = (await request.json()) as { username?: unknown; password?: unknown };
		const { username, password } = body;

		if (typeof username !== 'string' || typeof password !== 'string') {
			return json({ error: 'Correo o contraseña incorrectos.' }, { status: 400 });
		}

		const token = await authenticate(username, password, env as unknown as Record<string, string | undefined>);

		clearAttempts(request);
		const response = json({ success: true });
		setAuthCookie(response, token);
		return response;
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		if (message.includes('Falta') || message.includes('inválido')) {
			return json({ error: message }, { status: 500 });
		}
		if (message.includes('Correo o contraseña')) {
			return json({ error: message }, { status: 401 });
		}
		return json({ error: 'Correo o contraseña incorrectos.' }, { status: 401 });
	}
};
