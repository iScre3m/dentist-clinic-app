import { defineConfig, devices } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',
	use: {
		baseURL: APP_URL,
		trace: 'on-first-retry'
	},
	webServer: {
		command: 'pnpm dev',
		url: APP_URL,
		reuseExistingServer: !process.env.CI,
		env: {
			DATABASE_PATH: './test.db',
			FAKE_CALENDAR: '1'
		}
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
