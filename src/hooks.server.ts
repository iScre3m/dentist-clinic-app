import { building } from '$app/env';
import { auth } from '#lib/server/auth.ts';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit/hooks';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.session = await auth.api.getSession({ headers: event.request.headers });

	return svelteKitHandler({ event, resolve, auth, building });
};
