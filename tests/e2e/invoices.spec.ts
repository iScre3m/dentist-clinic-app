import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context }) => {
	await context.clearCookies();
});

test('unauthenticated requests to pricing redirect to login', async ({ page }) => {
	await page.goto('/precios');
	await expect(page).toHaveURL(/\/login$/);
});

test('unauthenticated requests to invoice page redirect to login', async ({ page }) => {
	await page.goto('/turnos/x/factura');
	await expect(page).toHaveURL(/\/login$/);
});

test('unauthenticated requests to facturas redirect to login', async ({ page }) => {
	await page.goto('/facturas');
	await expect(page).toHaveURL(/\/login$/);
});
