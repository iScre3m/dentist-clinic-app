# Docker Guide

## Prerequisites
- Docker and Docker Compose installed
- Copy `.env.example` to `.env` and configure it

## Environment setup
1. Copy environment file:
```bash
cp .env.example .env
```

2. Set required values in `.env`:
- `BETTER_AUTH_SECRET` - generate a random secret
- `BETTER_AUTH_URL` - for dev: `http://localhost:5173`, for prod: your domain
- `APP_URL` - same as BETTER_AUTH_URL
- `GOOGLE_SERVICE_ACCOUNT_JSON` - base64-encoded service account JSON (if using Google Calendar)
- `GOOGLE_CALENDAR_ID` - your calendar ID
- `FAKE_CALENDAR=1` - use fixtures for development/testing without Google

## Development with Docker

```bash
# Start dev server with hot reload
docker compose -f docker-compose.dev.yml up

# In another terminal, seed the database (first time)
docker compose -f docker-compose.dev.yml exec app pnpm db:seed

# Stop
docker compose -f docker-compose.dev.yml down
```

The app will be available at http://localhost:5173

## Production with Docker

```bash
# Build and start
docker compose up --build -d

# Run migrations and seed (first time)
docker compose exec app pnpm db:migrate
docker compose exec app pnpm db:seed

# View logs
docker compose logs -f

# Stop
docker compose down
```

The app will be available at http://localhost:3000

## Database
- SQLite database is stored in `./data/` directory mounted as volume
- Migrations run automatically via entrypoint
- Backup: `sqlite3 ./data/local.db ".backup './data/backup-$(date +%Y-%m-%d).db'"`
- Restore: stop container, replace DB file, remove `-wal` and `-shm` files if present, start container

## Useful commands

```bash
# Run staff update
docker compose exec app pnpm staff:update

# Prune old records
docker compose exec app pnpm db:prune

# Access container shell
docker compose exec app sh
```

## Notes
- Never commit `.env` or database files
- For Google Calendar, share calendar with service account email (read-only)
- Seed refuses to run in production (NODE_ENV=production) - see package.json
- The dev container mounts `src/`, `static/`, `templates/`, `scripts/` and `drizzle/` from the host, so
  edits hot-reload without rebuilding. `node_modules` and `.svelte-kit` stay in the image.
  - Rebuild after changing `package.json`, `Dockerfile.dev` or `vite.config.ts`:
    `docker compose -f docker-compose.dev.yml up -d --build`
  - `src/app.html` is cached by the dev server; restart the container after editing it.
  - HMR relies on `VITE_USE_POLLING=1` because Docker Desktop bind mounts do not deliver
    filesystem events into the container.
