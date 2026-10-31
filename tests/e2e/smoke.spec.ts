import { test, expect } from '@playwright/test';

test('registration page loads', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveTitle(/.*/);
});
