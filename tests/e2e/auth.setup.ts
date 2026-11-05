import { test as setup, expect } from '@playwright/test';
import { STAFF_EMAIL, STAFF_PASSWORD, STAFF_STORAGE_STATE } from './support/env.ts';

/**
 * Creates the staff session once per run through the JWT login API instead of
 * driving the login form, and stores the resulting `auth_token` cookie in a
 * storage state file. Staff specs then start already authenticated.
 */
setup('authenticate as staff', async ({ request }) => {
	const signIn = await request.post('/api/login', {
		data: { username: STAFF_EMAIL, password: STAFF_PASSWORD }
	});

	expect(
		signIn.ok(),
		`No se pudo iniciar sesión por API (${signIn.status()}). ` +
			`Verificá que AUTH_USERNAME/AUTH_PASSWORD_HASH estén en .env. ` +
			`Respuesta: ${await signIn.text()}`
	).toBeTruthy();

	// Confirm the cookie really resolves to a session before saving it, so a
	// broken auth configuration fails here with a clear message.
	const session = await request.get('/api/session');
	const body = await session.json().catch(() => null);

	expect(
		body?.user?.username,
		'La sesión creada por API no es válida.'
	).toBe(STAFF_EMAIL);

	await request.storageState({ path: STAFF_STORAGE_STATE });
});
