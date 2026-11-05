/**
 * End-to-end tests for the JWT authentication user flows.
 *
 * Browser-level coverage of what `auth-api.spec.ts` verifies at the API
 * level: the full login flow through the real form, failed-login handling,
 * session persistence across reloads, the logout flow, and access control on
 * protected routes.
 *
 * Uses plain `@playwright/test` (not `./fixtures.ts`) so every context starts
 * without the saved staff session — these tests drive the real login and
 * logout themselves.
 */

import { test, expect, type Page } from '@playwright/test';
import { STAFF_EMAIL, STAFF_PASSWORD } from './support/env.ts';
import { waitForHydration } from './support/hydration.ts';

const PROTECTED_ROUTES = ['/dashboard', '/pacientes', '/follow-ups'];

async function login(page: Page, username: string, password: string): Promise<void> {
	await page.goto('/login');
	// Clicking a form before hydration submits it natively and loses the
	// client-side handler; wait for the marker first.
	await waitForHydration(page);
	await page.getByLabel('Correo o usuario').fill(username);
	await page.getByLabel('Contraseña').fill(password);
	await page.getByRole('button', { name: 'Ingresar' }).click();
}

/* ------------------------------------------------------------------ */
/*  Protected routes (requirement 5.2)                                 */
/* ------------------------------------------------------------------ */

test.describe('Protected route access control', () => {
	for (const route of PROTECTED_ROUTES) {
		test(`redirects an unauthenticated visitor from ${route} to /login`, async ({ page }) => {
			await page.goto(route);
			await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
			await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
		});
	}
});

/* ------------------------------------------------------------------ */
/*  Full login flow (requirement 5.1)                                  */
/* ------------------------------------------------------------------ */

test.describe('Login flow', () => {
	test('logs in through the form and lands on the dashboard showing the staff user', async ({
		page
	}) => {
		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/login/);

		await login(page, STAFF_EMAIL, STAFF_PASSWORD);

		// The app layout is visible with the logged-in user's email.
		await expect(page).toHaveURL(/\/dashboard/);
		await expect(page.getByText(STAFF_EMAIL)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Salir' })).toBeVisible();
	});

	test('shows a Spanish error for wrong credentials and stays on the login page', async ({
		page
	}) => {
		await login(page, STAFF_EMAIL, 'contraseña-equivocada');

		await expect(page).toHaveURL(/\/login/);
		await expect(page).not.toHaveURL(/\/dashboard/);
		await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible();

		// The form is still fully usable (state kept client-side, no reload).
		await expect(page.getByLabel('Correo o usuario')).toHaveValue(STAFF_EMAIL);
		await expect(page.getByLabel('Contraseña')).toHaveValue('contraseña-equivocada');
	});

	test('shows a Spanish error for an unknown username', async ({ page }) => {
		await login(page, 'nadie@example.com', STAFF_PASSWORD);

		await expect(page).toHaveURL(/\/login/);
		await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible();
	});
});

/* ------------------------------------------------------------------ */
/*  Session persistence (requirement 5.5)                              */
/* ------------------------------------------------------------------ */

test.describe('Session persistence', () => {
	test('a page reload keeps the session without re-login', async ({ page }) => {
		await login(page, STAFF_EMAIL, STAFF_PASSWORD);
		await expect(page).toHaveURL(/\/dashboard/);

		await page.reload();

		await expect(page).toHaveURL(/\/dashboard/);
		await expect(page.getByText(STAFF_EMAIL)).toBeVisible();
		expect(await page.getByRole('button', { name: 'Ingresar' }).count()).toBe(0);
	});
});

/* ------------------------------------------------------------------ */
/*  Logout flow (requirement 1.5 / 5.3)                                */
/* ------------------------------------------------------------------ */

test.describe('Logout flow', () => {
	test('logging out returns to /login and the session is really gone', async ({ page }) => {
		await login(page, STAFF_EMAIL, STAFF_PASSWORD);
		await expect(page).toHaveURL(/\/dashboard/);

		await page.getByRole('button', { name: 'Salir' }).click();
		await expect(page).toHaveURL(/\/login(?:\?.*)?$/);

		// The cleared cookie must not resurrect from the browser alone.
		const session = await page.request.get('/api/session');
		expect(session.status()).toBe(401);

		// Protected navigation redirects again.
		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
	});

	test('after logout the login form works again for a next sign-in', async ({ page }) => {
		await login(page, STAFF_EMAIL, STAFF_PASSWORD);
		await expect(page).toHaveURL(/\/dashboard/);

		await page.getByRole('button', { name: 'Salir' }).click();
		await expect(page).toHaveURL(/\/login(?:\?.*)?$/);

		await login(page, STAFF_EMAIL, STAFF_PASSWORD);
		await expect(page).toHaveURL(/\/dashboard/);
	});
});
