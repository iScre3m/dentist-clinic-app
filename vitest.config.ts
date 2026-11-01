import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Unit tests only. Playwright specs live in `tests/e2e` and are run by
		// `pnpm test:e2e`; collecting them here would fail the unit run.
		include: ['src/**/*.test.ts']
	}
});
