import { test as setup, expect } from '@playwright/test';
import { STAFF_EMAIL, STAFF_PASSWORD, STAFF_STORAGE_STATE } from './support/env.ts';

/**
 * Creates the staff session once per run through the Better Auth API instead of
 * driving the login form, and stores the resulting cookies in a storage state
 * file. Staff specs then start already authenticated.
 */
setup('authenticate as staff', async ({ request }) => {
	const signIn = await request.post('/api/auth/sign-in/email', {
		data: { email: STAFF_EMAIL, password: STAFF_PASSWORD }
	});

	expect(
		signIn.ok(),
		`No se pudo iniciar sesión por API (${signIn.status()}). ` +
			`Verificá que el seed haya creado ${STAFF_EMAIL} en la base de prueba. ` +
			`Respuesta: ${await signIn.text()}`
	).toBeTruthy();

	// Confirm the cookie really resolves to a session before saving it, so a
	// broken auth configuration fails here with a clear message.
	const session = await request.get('/api/auth/get-session');
	const body = await session.json().catch(() => null);

	expect(body?.user?.email, 'La sesión creada por API no es válida.').toBe(STAFF_EMAIL);

	await request.storageState({ path: STAFF_STORAGE_STATE });
});
