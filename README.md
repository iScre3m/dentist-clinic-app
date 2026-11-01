# Dr. Laura — Practice Admin

Administrative coordination app for a single dental practice in Argentina.
It complements Google Calendar; it does not replace it.

**Status:** MVP implementation. Database schema, staff authentication, seed data, dashboard, patient registration, Google Calendar sync, WhatsApp reminders, attendance, and follow-ups are implemented.

## What it does

- Reads appointments from the practice's Google Calendar (read-only).
- Links each calendar event to a registered patient by phone number.
- Lets patients register themselves at `/` with a name, a WhatsApp
  number, and consent. It is the only public page. Registered patients
  appear at `/pacientes`, not on the dashboard: the dashboard lists only
  appointments synced from Google Calendar, which are matched to patients
  by phone number during synchronization.
- Lets staff send WhatsApp reminders manually through a `wa.me` link.
- Records attendance outcomes: confirmed, attended, no-show.
- Tracks administrative follow-up tasks for multi-session treatments.

It does **not** schedule appointments, send messages automatically, store
clinical data, or handle billing.

## Stack

- SvelteKit + Svelte 5 + TypeScript
- Tailwind CSS + shadcn-svelte
- SQLite + Drizzle ORM / Drizzle Kit
- Better Auth (one staff account, no signup)
- Valibot for server-side validation
- Playwright for end-to-end tests
- pnpm

## Requirements

- Node.js (LTS) and pnpm
- A Google Cloud project with the Calendar API enabled
- A durable disk path for the SQLite file in production

## Environment variables

Copy `.env.example` to `.env`. Never commit `.env`.

| Variable                      | Purpose                                             |
| ----------------------------- | --------------------------------------------------- |
| `DATABASE_PATH`               | Absolute path to the SQLite file on durable storage |
| `BETTER_AUTH_SECRET`          | Session signing secret                              |
| `BETTER_AUTH_URL`             | Public base URL for auth                            |
| `APP_URL`                     | Public base URL of the app                          |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Base64-encoded service-account key                  |
| `GOOGLE_CALENDAR_ID`          | The practice calendar ID                            |
| `FAKE_CALENDAR`               | `1` in development and tests to use fixtures        |

## Local setup

```sh
pnpm install
cp .env.example .env      # then set a random BETTER_AUTH_SECRET
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Seeded staff account comes from `SEED_STAFF_EMAIL` and
`SEED_STAFF_PASSWORD` (default `staff@example.com`, password
`change-me-too`). Change the account and the password before any real use.

`db:seed` is safe to run twice: existing users and synthetic records are not
duplicated. It refuses to run when `NODE_ENV=production`.

## Commands

| Command                       | Purpose                                                |
| ----------------------------- | ------------------------------------------------------ |
| `pnpm dev`                    | Start the dev server                                   |
| `pnpm build` / `pnpm preview` | Production build and preview                           |
| `pnpm check`                  | svelte-check and TypeScript diagnostics                |
| `pnpm lint` / `pnpm lint:fix` | ESLint (flat config) and auto-fix                      |
| `pnpm format`                 | Format with Prettier                                   |
| `pnpm db:generate`            | Generate a Drizzle migration from the schema           |
| `pnpm db:migrate`             | Apply migrations                                       |
| `pnpm db:seed`                | Create the two staff accounts and synthetic data       |
| `pnpm test:unit`              | Vitest unit tests (phone normalization, rate limiting) |
| `pnpm db:prune`               | Delete records older than 90 days                          |
| `pnpm staff:update`           | Change a staff name, email, or password                |
| `pnpm test:e2e`               | Playwright end-to-end tests                            |

## Google Calendar (service account)

1. Create a Google Cloud project and enable the Calendar API.
2. Create a service account and download its JSON key.
3. Share the practice calendar with the service-account email, permission
   **See all event details** (read-only).
4. Store the key base64-encoded in `GOOGLE_SERVICE_ACCOUNT_JSON`.
5. Set `GOOGLE_CALENDAR_ID` to the calendar ID.

No OAuth consent screen, no refresh token, and no callback route.

Sync runs only when staff trigger it: a **Sync now** button or opening the
app. There is no scheduler.

## Database and backups

The database is a single SQLite file with WAL enabled.

Backup (planned, documented in `Operations` below):

```sh
sqlite3 "$DATABASE_PATH" ".backup 'backup-$(date +%Y-%m-%d).db'"
```

Restore: stop the app, replace the database file, remove any leftover
`-wal` and `-shm` files, then start the app.

Retention: `pnpm db:prune` removes reminder records and past appointments
older than 90 days. Past appointments with no recorded outcome are kept
until resolved.

## Operations

Short operational notes for whoever runs the app:

- **Sync fails:** check the dashboard message and the last successful
  sync time. A `410 GONE` token is handled automatically by a full
  resync. If the key was revoked or the calendar unshared, sync fails
  with a clear error.
- **Rotate the Google key:** create a new key for the service account,
  update `GOOGLE_SERVICE_ACCOUNT_JSON`, restart the app, then disable the
  old key.
- **Reset a staff password:** `pnpm staff:update`. There is no reset
  email flow.
- **Backups:** run the backup command on a schedule and keep copies off
  the server. Test a restore at least once.

## Data and privacy

- Development, demos, and tests use synthetic patient data only.
- Never commit the database, keys, or real patient data.
- The only public page is the patient registration form (`/`).
  Everything else requires a staff login.
- Registration normalizes the number to E.164 with `libphonenumber-js`,
  stores only E.164, and rejects numbers that are not valid mobiles for the
  chosen country. Argentina's `9` is retried automatically when the patient
  types the number the way they dial it.
- Registration is idempotent by phone number and never reveals whether a
  number is already registered.
- The registration endpoint is rate-limited to 5 attempts per hour per IP.
  The counter lives in process memory, so it resets on restart.
- Consent text and version: `templates/consent/consentimiento.es.md`. The
  app reads the version from that file; editing the patient-facing text
  requires bumping it.
- WhatsApp message templates: `templates/whatsapp/reminder.es.md`.

## Project structure

```text
src/lib/components/ui           shadcn-svelte components (vendored, read-only)
src/lib/format.ts               date formatting for America/Argentina/Buenos_Aires
src/lib/schemas                 Valibot schemas
src/lib/server/auth.ts          Better Auth configuration
src/lib/server/consent.ts       consent version and patient-facing text
src/lib/server/db               Drizzle schema and client
src/lib/server/services/patients phone normalization and registration
src/lib/server/rate-limit.ts    in-memory registration rate limit
src/lib/utils.ts                `cn` and shadcn prop helper types
src/routes                      SvelteKit routes (`/` is the public registration page)
scripts                         seed and maintenance scripts
drizzle                         generated migrations
tests                           Playwright tests (to come)
templates                       WhatsApp and consent copy
```

UI components come from shadcn-svelte and live in `src/lib/components/ui`. Add
more with `pnpm dlx shadcn-svelte@latest add <component>`; `components.json`
points its aliases at `#lib`. Generated components import `#lib/utils.js`,
which resolves through the `#lib/*` subpath import, so no `$lib` alias is
needed. Keep vendored files close to the registry output and put app-specific
components outside that folder.

The project uses SvelteKit 3 conventions: configuration lives in
`vite.config.ts` (there is no `svelte.config.js`), `src/lib` is imported as
`#lib/...` with an explicit file extension, and build-time constants come
from `$app/env`.
