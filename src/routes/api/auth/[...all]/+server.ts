import { createAuth } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.js';
import { toSvelteKitHandler } from 'better-auth/svelte-kit';

export const prerender = false;

const auth = createAuth(
	db,
	import.meta.env.BETTER_AUTH_SECRET,
	import.meta.env.BETTER_AUTH_URL ?? 'http://localhost:5173'
);

export const GET = toSvelteKitHandler(auth);
export const POST = toSvelteKitHandler(auth);
