import { test, expect } from '@playwright/test';

// Public specs must never inherit a session, even if a future config starts
// applying a storage state globally.
test.beforeEach(async ({ context }) => {
	await context.clearCookies();
	expect(await context.cookies()).toHaveLength(0);
});

// Public pages and the login form run without a session on purpose: these specs
// must prove the unauthenticated experience still works.
test('login with seeded staff account', async ({ page }) => {
	await page.goto('/login');
	// Wait for hydration: a click on a non-interactive form would submit it
	// natively as a GET instead of running the client-side sign-in.
	await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
	await page.getByLabel('Correo').fill('staff@example.com');
	await page.getByLabel('Contraseña').fill('change-me-too');
	await page.getByRole('button', { name: 'Ingresar' }).click();
	await page.waitForURL('**/dashboard');
	await expect(page.getByRole('heading', { name: 'Panel' })).toBeVisible();
});

test('staff pages redirect to login without a session', async ({ page }) => {
	await page.goto('/dashboard');
	await expect(page).toHaveURL(/\/login$/);
});

test('public registration page renders consent text', async ({ page }) => {
	await page.goto('/');
	await expect(
		page.getByRole('heading', { name: 'Registrate para recibir recordatorios' })
	).toBeVisible();
	await page.getByText('Leer texto de consentimiento').click();
	await expect(
		page.getByRole('paragraph').filter({
			hasText: 'Acepto recibir recordatorios de turnos y avisos administrativos del consultorio'
		})
	).toBeVisible();
});

test('registration form rejects invalid name', async ({ page }) => {
	await page.goto('/');
	await page.getByLabel('Nombre').fill('123');
	await page.getByLabel('Apellido').fill('Paciente');
	await page.getByLabel('Número de WhatsApp').fill('5512345678');
	await page.getByRole('button', { name: 'Registrarme' }).click();
	await expect(page.getByText('Solo letras, espacios y apóstrofos.')).toBeVisible();
});

test('registration form explains why a landline is rejected', async ({ page }) => {
	await page.goto('/');
	await page.getByLabel('Nombre').fill('Ana');
	await page.getByLabel('Apellido').fill('Perez');
	await page.getByLabel('Número de WhatsApp').fill('11 5555 0001');
	await page.getByLabel(/Acepto recibir/).check();
	await page.getByRole('button', { name: 'Registrarme' }).click();
	await expect(page.getByRole('alert')).toContainText(
		'Necesitamos un número de celular, porque WhatsApp no funciona con líneas fijas.'
	);
});

test('registration form accepts a locally dialed mobile number', async ({ page }) => {
	await page.goto('/');
	await page.getByLabel('Nombre').fill('Ana');
	await page.getByLabel('Apellido').fill('Perez');
	await page.getByLabel('Número de WhatsApp').fill('11 15 7777 0001');
	await page.getByLabel(/Acepto recibir/).check();
	await page.getByRole('button', { name: 'Registrarme' }).click();
	await expect(page.getByRole('alert')).toContainText('Listo. Recibimos tu registro.');
	await expect(page.getByRole('button', { name: 'Listo. Recibimos tu registro.' })).toBeDisabled();
});
