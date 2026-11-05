import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearAuthCookie } from '#lib/server/auth/index.js';

export const POST: RequestHandler = async () => {
	const response = json({ success: true });
	clearAuthCookie(response);
	return response;
};
