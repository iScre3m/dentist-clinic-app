import { test as base, expect } from '@playwright/test';
import { STAFF_SESSION_COOKIE, STAFF_STORAGE_STATE } from './support/env.ts';

/**
 * Test for pages that require a logged-in staff user.
 *
 * Importing `test` from this module loads the session saved by `auth.setup.ts`,
 * so specs never repeat the login form and never depend on client-side sign-in
 * timing. Public pages must keep using `@playwright/test` directly so they run
 * without a session.
 *
 * Isolation: Playwright creates a fresh browser context per test, so the cookies
 * below never reach a test from another file, another worker, or a previous run.
 * The saved session is shared by every staff test, so a spec must never call
 * sign-out — that would invalidate the session for the rest of the run.
 */
export const test = base.extend({
	storageState: STAFF_STORAGE_STATE
});

test.beforeEach(async ({ context }) => {
	const cookies = await context.cookies();
	expect(
		cookies.some((cookie) => cookie.name === STAFF_SESSION_COOKIE),
		'La sesión de personal no está cargada. Verificá que el proyecto "setup" ' +
			'haya creado tests/e2e/.auth/staff.json y que la sesión no haya expirado.'
	).toBeTruthy();
});

export { expect };
