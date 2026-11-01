import { defineConfig, devices } from '@playwright/test';
import { TEST_DATABASE_PATH } from './tests/e2e/support/env.ts';

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
			DATABASE_PATH: TEST_DATABASE_PATH,
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
