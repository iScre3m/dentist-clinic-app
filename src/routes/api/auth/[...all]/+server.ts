import { createAuth } from '#lib/server/auth.ts';
import { env } from 'cloudflare:workers';
import { db } from '#lib/server/db/index.js';
import { toSvelteKitHandler } from 'better-auth/svelte-kit';

const auth = createAuth(db, env.BETTER_AUTH_SECRET, env.BETTER_AUTH_URL ?? 'http://localhost:5173');

export const GET = toSvelteKitHandler(auth);
export const POST = toSvelteKitHandler(auth);
