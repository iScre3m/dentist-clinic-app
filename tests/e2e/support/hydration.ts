import { expect, type Page } from '@playwright/test';

/**
 * Waits until SvelteKit has hydrated the page.
 *
 * Before hydration a click on a form submits it natively (a GET/POST that
 * bypasses client-side validation), so every spec that clicks a form waits
 * for this marker first. The generous timeout covers the dev server's first
 * boot, which bundles client dependencies while the page is already open and
 * reloads it (`optimized dependencies changed. reloading`).
 */
export async function waitForHydration(page: Page): Promise<void> {
	await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true', { timeout: 20_000 });
}
