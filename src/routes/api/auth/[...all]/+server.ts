import { auth } from '#lib/server/auth.ts';
import { toSvelteKitHandler } from 'better-auth/svelte-kit';

export const GET = toSvelteKitHandler(auth);
export const POST = toSvelteKitHandler(auth);
