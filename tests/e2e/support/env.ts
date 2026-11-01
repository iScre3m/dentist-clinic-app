/**
 * Shared Playwright test configuration.
 *
 * The test database, the staff credentials and the saved browser session all
 * live here so `playwright.config.ts`, the global setup and the specs cannot
 * drift apart.
 */

/** Database used by the Playwright web server. Never the development database. */
export const TEST_DATABASE_PATH = './test.db';

/** Seeded staff account (see `scripts/seed.ts` and `.env.example`). */
export const STAFF_EMAIL = process.env.SEED_STAFF_EMAIL ?? 'staff@example.com';
export const STAFF_PASSWORD = process.env.SEED_STAFF_PASSWORD ?? 'change-me-too';

/** Session cookie written once by `auth.setup.ts` and reused by every staff test. */
export const STAFF_STORAGE_STATE = 'tests/e2e/.auth/staff.json';

/** Better Auth's session cookie name (default `cookiePrefix`). */
export const STAFF_SESSION_COOKIE = 'better-auth.session_token';
