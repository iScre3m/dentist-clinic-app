/**
 * Shared Playwright test configuration.
 *
 * The staff credentials and the saved browser session all live here so
 * `playwright.config.ts`, the global setup and the specs cannot drift apart.
 */

/** Seeded staff account (see `src/lib/server/db/seed.ts` and `.env.example`). */
export const STAFF_NAME = process.env.SEED_STAFF_NAME ?? 'Dra. Laura';
export const STAFF_EMAIL = process.env.SEED_STAFF_EMAIL ?? 'staff@example.com';
export const STAFF_PASSWORD = process.env.SEED_STAFF_PASSWORD ?? 'change-me-too';

/** Session cookie written once by `auth.setup.ts` and reused by every staff test. */
export const STAFF_STORAGE_STATE = 'tests/e2e/.auth/staff.json';

/** JWT session cookie name written by `auth.setup.ts` and reused by specs. */
export const STAFF_SESSION_COOKIE = 'auth_token';
