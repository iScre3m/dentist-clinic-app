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

- Node.js (LTS) and pnpm, or Docker
- A Google Cloud project with the Calendar API enabled
- A durable disk path for the SQLite file in production

## Google Calendar setup

### Get `GOOGLE_SERVICE_ACCOUNT_JSON`

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `dentist-appointment-app`) and select it.
3. Open the [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com) and enable it.
4. Open [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts) → Create service account (e.g. `dentist-calendar-service`).
5. Open the service account → Keys tab → Add key → Create new key → JSON. Download the file.
6. Base64-encode the JSON file and set it as `GOOGLE_SERVICE_ACCOUNT_JSON` in your `.env`.

### Get `GOOGLE_CALENDAR_ID`

1. Open [Google Calendar](https://calendar.google.com/).
2. Create or use a separate calendar for the clinic (recommended).
3. Calendar settings → Settings and sharing → Integrate calendar → Copy the **Calendar ID** value.
4. Set it as `GOOGLE_CALENDAR_ID` in your `.env`.

### Share the calendar with the service account

1. In calendar Settings and sharing → Share with specific people or groups → Add people and groups.
2. Add the `client_email` from the downloaded JSON (e.g. `dentist-calendar-service@...iam.gserviceaccount.com`).
3. Grant permission **See all event details** (read-only).
4. Click Send.

### Security precautions

- Add `.env` and the service account JSON file to `.gitignore`.
- Never commit your private key to GitHub.
- Never share credentials in chats or public repositories.
- Configure environment variables securely on your hosting platform.

### Test mode

Set `FAKE_CALENDAR=1` in development to use fixtures instead of real Google Calendar.

## Docker quick start

No Node.js or pnpm installation needed. You need Docker Engine with Compose v2.

1. Create your environment file and set a secret:

   ```sh
   cp .env.example .env
   # Set BETTER_AUTH_SECRET (openssl rand -base64 32).
   # Keep FAKE_CALENDAR=1 to try the app without Google Calendar.
   ```

2. Start the development container (hot reload on source changes):

   ```sh
   docker compose -f docker-compose.dev.yml up --build
   ```

3. In a second terminal, create the staff account and synthetic data:

   ```sh
   docker compose -f docker-compose.dev.yml exec app pnpm db:seed
   ```

Open http://localhost:5173 and sign in with `SEED_STAFF_EMAIL` and
`SEED_STAFF_PASSWORD` from `.env` (defaults: `staff@example.com` /
`change-me-too`). Stop with:

```sh
docker compose -f docker-compose.dev.yml down
```

### Production build

```sh
docker compose up -d --build

# First staff account. Seeding refuses NODE_ENV=production, so run it as development.
docker compose run --rm -e NODE_ENV=development app node_modules/.bin/tsx scripts/seed.ts

docker compose logs -f
docker compose down
```

The app is served at http://localhost:3000. Before exposing it, set
`BETTER_AUTH_URL` and `APP_URL` to the public HTTPS URL, set `FAKE_CALENDAR=0`,
and use a strong `BETTER_AUTH_SECRET`.

The SQLite database lives in `./data/local.db` on the host and survives
rebuilds and container restarts. Backups, maintenance commands, and rebuild
rules are in [DOCKER.md](DOCKER.md).

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
| `pnpm db:seed`                | Create the one staff account and synthetic data        |
| `pnpm test:unit`              | Vitest unit tests (phone normalization, rate limiting) |
| `pnpm db:prune`               | Delete records older than 90 days                      |
| `pnpm staff:update`           | Change a staff name, email, or password                |
| `pnpm test:e2e`               | Playwright end-to-end tests                            |

### End-to-end tests

`pnpm test:e2e` runs against its own database (`test.db`), never `local.db`.
Before the tests start, `tests/e2e/global-setup.ts` migrates that file, empties
every table, and runs `pnpm db:seed`, so the seeded staff account always exists.

The `setup` project (`tests/e2e/auth.setup.ts`) then signs in once through the
Better Auth API and saves the session cookies to `tests/e2e/.auth/staff.json`.
Specs that need a logged-in user import `test` from `tests/e2e/fixtures.ts`,
which loads that storage state; public pages keep importing
`@playwright/test` so they run without a session.

Each test runs in its own browser context, so sessions never cross tests or
workers. Public specs clear cookies before every test and assert none are
present; staff specs assert the session cookie is loaded, so a broken setup
fails immediately instead of silently redirecting to `/login`. Because the saved
session is shared by all staff tests, a staff spec must never sign out.

## Google Calendar (service account)

For full setup details, see [Google Calendar setup](#google-calendar-setup) above.

1. Create a Google Cloud project and enable the Calendar API.
2. Create a service account and download its JSON key.
3. Share the practice calendar with the service-account email, permission **See all event details** (read-only).
4. Store the key base64-encoded in `GOOGLE_SERVICE_ACCOUNT_JSON`.
5. Set `GOOGLE_CALENDAR_ID` to the calendar ID.

No OAuth consent screen, no refresh token, and no callback route.

Sync runs only when staff trigger it: a **Sync now** button or opening the app. There is no scheduler.

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
  stores only E.164, and rejects numbers that are not valid Argentine
  mobiles. Patients type the number the way they dial it (for example
  `11 15 5555 0001`); the mobile `9` is not added automatically, so the typed
  number must already be a valid mobile.
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
tests                           Playwright end-to-end tests
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
