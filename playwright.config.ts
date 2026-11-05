import { defineConfig, devices } from '@playwright/test';

// The support/env.ts helpers read SEED_STAFF_* from the environment; load the
// local .env so the seeded credentials in tests match the ones the app uses.
try {
	process.loadEnvFile('.env');
} catch {
	// No .env file available; the defaults in support/env.ts apply.
}

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',
	// Migrates and seeds the test database before anything else runs.
	globalSetup: './tests/e2e/global-setup.ts',
	use: {
		baseURL: APP_URL,
		trace: 'on-first-retry'
	},
	webServer: {
		command: 'pnpm dev',
		url: APP_URL,
		reuseExistingServer: !process.env.CI,
		env: {
			// The app runs in workerd and reads FAKE_CALENDAR from the
			// wrangler-loaded `.env` dev vars; this keeps a manual
			// `pnpm dev` to reproduce a spec consistent with CI.
			FAKE_CALENDAR: '1'
		}
	},
	projects: [
		// Logs in once through the Better Auth API and saves the session cookies.
		{
			name: 'setup',
			testMatch: /auth\.setup\.ts/
		},
		{
			name: 'chromium',
			dependencies: ['setup'],
			testIgnore: /auth\.setup\.ts/,
			use: { ...devices['Desktop Chrome'] }
		}
	]
});
