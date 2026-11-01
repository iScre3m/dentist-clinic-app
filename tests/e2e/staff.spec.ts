import { test, expect } from './fixtures.ts';

// Starts with the staff session saved by `auth.setup.ts`; no login form here.
test('dashboard shows sync panel and upcoming appointments', async ({ page }) => {
	await page.goto('/dashboard');
	const main = page.getByRole('main');

	await expect(main.getByRole('heading', { name: 'Panel' })).toBeVisible();
	await expect(main.getByText('Próximos turnos', { exact: true })).toBeVisible();
	await expect(main.getByText('Eventos sin paciente', { exact: true })).toBeVisible();
	await expect(main.getByText('Seguimientos', { exact: true })).toBeVisible();
});

// The session lives in this test's own browser context. Clearing it must leave
// no fallback login behind, which is what keeps parallel tests independent.
test('clearing the session leaves no fallback login', async ({ page, context }) => {
	await context.clearCookies();
	await page.goto('/dashboard');
	await expect(page).toHaveURL(/\/login$/);
});
