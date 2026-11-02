# Docker Guide

## Prerequisites

- Docker Engine with Compose v2 (`docker compose version`)
- A `.env` file (copy `.env.example`)

## Environment setup

```bash
cp .env.example .env
```

Then fill in `.env`:

| Variable                                                     | Notes                                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                                         | Required in production. Generate with `openssl rand -base64 32`.             |
| `BETTER_AUTH_URL`                                            | Public URL of the app. Dev: `http://localhost:5173`. Prod: your domain.      |
| `APP_URL`                                                    | Same value as `BETTER_AUTH_URL`. Used to build registration links.           |
| `GOOGLE_SERVICE_ACCOUNT_JSON`                                | Base64-encoded service-account JSON. Leave empty when using `FAKE_CALENDAR`. |
| `GOOGLE_CALENDAR_ID`                                         | The practice calendar ID.                                                    |
| `FAKE_CALENDAR`                                              | `1` reads calendar fixtures instead of Google. Use it for local work.        |
| `SEED_STAFF_NAME`, `SEED_STAFF_EMAIL`, `SEED_STAFF_PASSWORD` | Only read by `scripts/seed.ts`.                                              |

`DATABASE_PATH`, `NODE_ENV`, `PORT` and `HOST` are set by the compose files and
override the values in `.env`. Both map the host `./data` directory, but the
container path differs: dev uses `/data/local.db` (outside Vite's watched root,
so SQLite writes do not reload the page) and production uses
`/app/data/local.db`.

## Development with Docker

```bash
# Start the dev server with hot reload
docker compose -f docker-compose.dev.yml up --build

# In another terminal, create the staff account and sample data (first time)
docker compose -f docker-compose.dev.yml exec app pnpm db:seed

# Stop
docker compose -f docker-compose.dev.yml down
```

The app is available at http://localhost:5173.

`src/`, `static/`, `templates/`, `scripts/` and `drizzle/` are bind-mounted, so
edits on the host reload without a rebuild. `node_modules` and `.svelte-kit`
stay inside the image.

## Production with Docker

```bash
# Build and start (migrations run automatically before the server starts)
docker compose up -d --build

# Follow logs
docker compose logs -f

# Stop
docker compose down
```

The app is available at http://localhost:3000. Terminate HTTPS in front of it
(reverse proxy or hosting platform) and set `BETTER_AUTH_URL`/`APP_URL` to the
public HTTPS URL.

### Creating the first staff account

Seeding refuses to run with `NODE_ENV=production` by design. Run the seed
script with the development environment against the same data directory:

```bash
docker compose run --rm -e NODE_ENV=development app node_modules/.bin/tsx scripts/seed.ts
```

Seeding is idempotent, so running it again will not duplicate the account.

## Database

- SQLite file: `./data/local.db` on the host; `/data/local.db` in the dev
  container and `/app/data/local.db` in the production container.
- WAL mode is on, so `data/` also contains `local.db-wal` and `local.db-shm`.
- The database is never baked into the image; `./data` is the only persistent state.
- Migrations run on every container start via the compose `command`.

### Backup

With the app stopped (most consistent):

```bash
docker compose stop app
cp -r data data-backup-$(date +%Y-%m-%d)
docker compose start app
```

If `sqlite3` is installed on the host you can back up while it runs:

```bash
sqlite3 ./data/local.db ".backup './data/backup-$(date +%Y-%m-%d).db'"
```

### Restore

```bash
docker compose stop app
cp data-backup-YYYY-MM-DD/local.db ./data/local.db
rm -f ./data/local.db-wal ./data/local.db-shm
docker compose start app
```

## Maintenance commands

Run these against the running container. They use `tsx` directly to avoid
pnpm's dependency check on every invocation.

```bash
# Change a staff name, email or password (staff data is never edited in the UI)
docker compose exec app node_modules/.bin/tsx scripts/staff-update.ts \
  --email staff@example.com --password 'new-password'

# Delete reminder records and resolved appointments older than 90 days
docker compose exec app node_modules/.bin/tsx scripts/prune.ts

# Open a shell in the container
docker compose exec app sh
```

## Rebuild rules

Rebuild the images after changing `package.json`, `pnpm-lock.yaml`,
`pnpm-workspace.yaml`, `vite.config.ts`, or either Dockerfile:

```bash
docker compose up -d --build
docker compose -f docker-compose.dev.yml up -d --build
```

The dev container mounts source files, so ordinary code edits do not need a
rebuild.

## Notes

- pnpm is pinned in both Dockerfiles (`ARG PNPM_VERSION`) to match the pnpm
  that generated `pnpm-lock.yaml`. Bump it in the Dockerfiles when you upgrade
  pnpm locally.
- `pnpm-workspace.yaml` carries `allowBuilds`, which lets esbuild and
  better-sqlite3 run their install scripts. It is copied into both images.
- The production image runs as the non-root `nodejs` user and includes `src/`
  and `scripts/` so maintenance commands work.
- Never commit `.env`, `./data`, or any `*.db` file.
- For Google Calendar, share the practice calendar read-only with the
  service-account email.
