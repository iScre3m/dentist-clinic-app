import { building } from '$app/env';
import { auth } from '#lib/server/auth.ts';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit/hooks';

// Refuse to serve in production without a secret. Checked here rather than in
// the auth module so `vite build` and the CLI scripts keep working.
if (!building && process.env.NODE_ENV === 'production' && !process.env.BETTER_AUTH_SECRET) {
	throw new Error('Falta BETTER_AUTH_SECRET.');
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.session = await auth.api.getSession({ headers: event.request.headers });

	return svelteKitHandler({ event, resolve, auth, building });
};
